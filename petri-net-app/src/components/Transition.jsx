import React, { useCallback, useRef } from 'react';
import { Rect, Text, Group } from 'react-konva';
import { usePetriNet } from '../contexts/PetriNetContext';
import { useEditorUI } from '../contexts/EditorUIContext';
import { applyMultiDragDeltaFromSnapshot } from '../features/selection/selection-utils';

// Detect touch device - touch events fire much more frequently than mouse
const IS_TOUCH_DEVICE = typeof window !== 'undefined' && 
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// Get dynamic throttle based on element count and device type
// Touch devices need MUCH more aggressive throttling due to higher event rates (120-240Hz vs 60Hz)
// and lower CPU power compared to desktop
const getThrottleMs = (elementCount) => {
  if (IS_TOUCH_DEVICE) {
    // Mobile: very aggressive throttling (4x more than desktop)
    if (elementCount > 500) return 800;  // ~1.25fps for very large nets
    if (elementCount > 100) return 600;  // ~1.7fps for large nets
    return 400;                          // 2.5fps for small nets
  }
  // Desktop: lighter throttling
  if (elementCount > 500) return 100;    // 10fps for very large nets
  return 50;                             // 20fps for normal nets
};

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
    isIdSelected,
    setSelection,
    mode,
    arcStart
  } = usePetriNet();
  // netMode provided by context
  
  // Throttle state updates during drag to prevent crashes from vigorous shaking
  const lastDragUpdateRef = useRef(0);
  
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

  const handleDragStart = () => {
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
    
    // THROTTLE: Skip state update if not enough time has passed
    // This prevents crashes from vigorous shaking causing too many arc redraws
    // Use dynamic throttle based on element count and device type
    const elementCount = (elements.places?.length || 0) + (elements.transitions?.length || 0);
    const throttleMs = getThrottleMs(elementCount);
    const now = performance.now();
    if (now - lastDragUpdateRef.current < throttleMs) {
      return;
    }
    lastDragUpdateRef.current = now;
    
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
      onTap={(evt) => {
        // Prevent double firing if onTouchEnd already handled this event
        if (evt.evt && evt.evt._handledByTouchEnd) return;
        onSelect(id, evt);
      }}
      onTouchEnd={(e) => {
        // On mobile, when creating an arc, touch end should complete the arc
        if (mode === 'arc' && arcStart && arcStart.element.id !== id) {
          onSelect(id, e);
          // Mark event as handled to prevent onTap from firing and starting a new arc
          if (e.evt) e.evt._handledByTouchEnd = true;
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
