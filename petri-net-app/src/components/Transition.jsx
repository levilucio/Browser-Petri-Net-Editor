import React, { useCallback } from 'react';
import { Rect, Text, Group } from 'react-konva';
import { usePetriNet } from '../contexts/PetriNetContext';
import { useEditorUI } from '../contexts/EditorUIContext';
import { applyMultiDragDeltaFromSnapshot } from '../features/selection/selection-utils';

// Cooldown period after drag ends before another drag can start (ms)
// This prevents race conditions when rapidly switching between elements
const DRAG_COOLDOWN_MS = 500;

const GUARD_FONT_SIZE = 11;
const GUARD_CHAR_FACTOR = 0.48;
const GUARD_MAX_WIDTH = 160;
const GUARD_HORIZONTAL_PADDING = 6;

const Transition = ({
  id,
  x,
  y,
  label,
  guard,
  isSelected,
  isEnabled,
  onSelect,
  onChange,
}) => {
  const baseWidth = 40;
  const baseHeight = 50;

  // Access UI state from EditorUIContext
  const { 
    gridSnappingEnabled, 
    setSnapIndicator,
  } = useEditorUI();
  
  // Access core editor state from PetriNetContext
  const { 
    setIsDragging, 
    snapToGrid, 
    simulationSettings,
    netMode,
    elements,
    selectedElements,
    setElements,
    multiDragRef,
    dragCooldownRef,
    isIdSelected,
    setSelection,
    mode,
    arcStart
  } = usePetriNet();
  // netMode provided by context
  
  const buildDragSnapshot = useCallback((selectedNodeIds) => {
    const startPositions = new Map();
    elements.places.forEach(p => {
      if (selectedNodeIds.has(p.id)) {
        startPositions.set(p.id, { type: 'place', x: p.x, y: p.y });
      }
    });
    elements.transitions.forEach(t => {
      if (selectedNodeIds.has(t.id)) {
        startPositions.set(t.id, { type: 'transition', x: t.x, y: t.y });
      }
    });
    const startArcPoints = new Map();
    elements.arcs.forEach(a => {
      if (selectedNodeIds.has(a.source) && selectedNodeIds.has(a.target)) {
        const pts = Array.isArray(a.anglePoints) ? a.anglePoints.map(p => ({ x: p.x, y: p.y })) : [];
        startArcPoints.set(a.id, pts);
      }
    });
    return { startPositions, startArcPoints };
  }, [elements]);

  const handleDragStart = (e) => {
    // Check GLOBAL cooldown - if ANY drag just ended, block this drag entirely
    const timeSinceLastDrag = performance.now() - dragCooldownRef.current;
    if (timeSinceLastDrag < DRAG_COOLDOWN_MS) {
      // Block the drag entirely during cooldown by stopping propagation
      // and not updating any state
      if (e && e.target && typeof e.target.stopDrag === 'function') {
        e.target.stopDrag();
      }
      return;
    }
    
    // IMPORTANT: If a previous drag's snapshot still exists, clear it first
    // This prevents race conditions when rapidly switching between elements
    if (multiDragRef.current !== null) {
      multiDragRef.current = null;
    }
    
    // Set dragging state to true when drag starts
    setIsDragging(true);

    const alreadySelected = isIdSelected(id, 'transition');
    let selectedNodeIds;
    if (alreadySelected) {
      selectedNodeIds = new Set(
        selectedElements
          .filter(se => se.type === 'place' || se.type === 'transition')
          .map(se => se.id)
      );
    } else {
      selectedNodeIds = new Set([id]);
      if (typeof onSelect === 'function') {
        onSelect(id);
      }
    }

    const snapshot = buildDragSnapshot(selectedNodeIds);
    multiDragRef.current = { baseId: id, lastDelta: { dx: 0, dy: 0 }, ...snapshot };
  };

  const handleDragMove = (e) => {
    // Only apply snapping if grid snapping is enabled
    let currentPos = {
      x: e.target.x(),
      y: e.target.y()
    };
    if (gridSnappingEnabled) {
      const snappedPos = snapToGrid(currentPos.x, currentPos.y);
      setSnapIndicator({
        visible: true,
        position: snappedPos,
        elementType: 'transition'
      });
      e.target.position({ x: snappedPos.x, y: snappedPos.y });
      currentPos = snappedPos;
    }
    
    // Apply multi-drag delta to other selected nodes and keep arcs attached visually
    const snapshot = multiDragRef.current;
    // Guard: only process if snapshot exists, has valid data, and belongs to THIS element
    if (!snapshot || !snapshot.startPositions || snapshot.baseId !== id) {
      return;
    }
    
    const start = snapshot.startPositions.get(id);
    if (!start) return;
    
    const deltaX = currentPos.x - start.x;
    const deltaY = currentPos.y - start.y;
    const lastDelta = snapshot.lastDelta || { dx: 0, dy: 0 };
    
    // Skip if delta hasn't changed
    if (lastDelta.dx === deltaX && lastDelta.dy === deltaY) {
      return;
    }
    
    // Update lastDelta BEFORE setElements to prevent concurrent updates with same delta
    snapshot.lastDelta = { dx: deltaX, dy: deltaY };

    // Capture delta in closure to ensure correct values in async callback
    const capturedDelta = { dx: deltaX, dy: deltaY };
    setElements(prev => {
      // Double-check snapshot is still valid inside callback
      if (!snapshot || !snapshot.startPositions) {
        return prev;
      }
      return applyMultiDragDeltaFromSnapshot(prev, snapshot, capturedDelta, { gridSnappingEnabled, snapToGrid });
    });
  };

  const handleDragEnd = (e) => {
    // Record GLOBAL cooldown timestamp - blocks ALL element drags for DRAG_COOLDOWN_MS
    dragCooldownRef.current = performance.now();
    
    // When drag ends, the new position is in the parent's coordinate system (virtual coordinates)
    const newVirtualPos = {
      x: e.target.x(),
      y: e.target.y(),
    };

    // Clear snapshot tracking now that drag movement is complete
    multiDragRef.current = null;
    
    // Set dragging state to false when drag ends
    setIsDragging(false);
    
    // Hide the snap indicator
    setSnapIndicator({
      visible: false,
      position: null,
      elementType: null
    });

    // The onChange handler (from useElementManager) expects the new virtual position
    onChange(newVirtualPos);
  };

  const guardText = netMode === 'algebraic-int' ? String(guard || '') : '';

  let guardWidth = baseWidth;
  let guardWrap = 'none';

  if (guardText) {
    const estimated = guardText.length * GUARD_FONT_SIZE * GUARD_CHAR_FACTOR + GUARD_HORIZONTAL_PADDING * 2;
    if (estimated <= GUARD_MAX_WIDTH) {
      guardWidth = Math.max(baseWidth, estimated);
    } else {
      guardWidth = GUARD_MAX_WIDTH;
      guardWrap = 'char';
    }
  }

  return (
    <Group
      x={x}
      y={y}
      onClick={(evt) => onSelect(id, evt)}
      onTap={(evt) => onSelect(id, evt)}
      onTouchEnd={(e) => {
        // On mobile, when creating an arc, touch end should complete the arc
        if (mode === 'arc' && arcStart && arcStart.element.id !== id) {
          onSelect(id, e);
        }
      }}
      draggable={mode !== 'arc' || !arcStart}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      id={id} // Pass id for hit detection in ArcManager
      name='element' // Generic name for easier hit detection
      elementType='transition' // Custom attribute for type-specific logic
    >
      <Rect
        x={-baseWidth / 2}
        y={-baseHeight / 2}
        width={baseWidth}
        height={baseHeight}
        fill={isEnabled ? 'rgba(255, 255, 0, 0.8)' : 'gray'}
        stroke={isSelected ? 'blue' : (isEnabled ? 'rgba(255, 180, 0, 1)' : 'black')}
        strokeWidth={isSelected ? 3 : (isEnabled ? 3 : 2)}
      />
      <Text
        text={label}
        fontSize={14}
        fill="black"
        x={-baseWidth / 2}
        y={(baseHeight / 2) + 5}
        width={baseWidth}
        align="center"
        listening={false}
      />
      {netMode === 'algebraic-int' && guardText && (
        <Text
          text={guardText}
          fontSize={GUARD_FONT_SIZE}
                      fill="#333"
          x={-guardWidth / 2}
          y={-baseHeight / 2 - 14}
          width={guardWidth}
          align="center"
          wrap={guardWrap}
          listening={false}
          ellipsis={guardWrap !== 'none'}
        />
      )}
      {netMode === 'algebraic-int' && !guardText && (
        <Text
          text=""
          fontSize={GUARD_FONT_SIZE}
          fill="gray"
          x={-baseWidth / 2}
          y={-baseHeight / 2 - 14}
          width={baseWidth}
          align="center"
          listening={false}
        />
      )}
    </Group>
  );
};

export default Transition;
