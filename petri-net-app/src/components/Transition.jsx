import React, { useRef, useCallback } from 'react';
import { Rect, Text, Group } from 'react-konva';
import { usePetriNet } from '../contexts/PetriNetContext';
import { useEditorUI } from '../contexts/EditorUIContext';
import { applyMultiDragDeltaFromSnapshot } from '../features/selection/selection-utils';

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
    setSelection
  } = usePetriNet();
  // netMode provided by context
  
  const dragSchedulerRef = useRef({
    pending: false,
    rafId: null,
    delta: { dx: 0, dy: 0 },
    lastApplied: { dx: 0, dy: 0 },
  });

  const runMultiDragUpdate = useCallback(() => {
    const scheduler = dragSchedulerRef.current;
    scheduler.pending = false;
    scheduler.rafId = null;

    if (!multiDragRef.current || !multiDragRef.current.startPositions) {
      return;
    }

    setElements(prev => {
      if (!multiDragRef.current || !multiDragRef.current.startPositions) {
        return prev;
      }
      const snapshot = multiDragRef.current;
      const next = applyMultiDragDeltaFromSnapshot(prev, snapshot, scheduler.delta, { gridSnappingEnabled, snapToGrid });
      scheduler.lastApplied = { ...scheduler.delta };
      return next;
    });
  }, [gridSnappingEnabled, snapToGrid, setElements, multiDragRef]);

  const scheduleMultiDragUpdate = useCallback((delta) => {
    const scheduler = dragSchedulerRef.current;
    const sameAsPending = scheduler.pending &&
      scheduler.delta &&
      scheduler.delta.dx === delta.dx &&
      scheduler.delta.dy === delta.dy;
    if (sameAsPending) {
      return;
    }

    const sameAsLastApplied = !scheduler.pending &&
      scheduler.lastApplied &&
      scheduler.lastApplied.dx === delta.dx &&
      scheduler.lastApplied.dy === delta.dy;
    if (sameAsLastApplied) {
      return;
    }

    scheduler.delta = delta;

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      runMultiDragUpdate();
      return;
    }

    if (!scheduler.pending) {
      scheduler.pending = true;
      scheduler.rafId = window.requestAnimationFrame(runMultiDragUpdate);
    }
  }, [runMultiDragUpdate]);

  const flushMultiDragUpdate = useCallback(() => {
    const scheduler = dragSchedulerRef.current;
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function' && scheduler.rafId !== null) {
      window.cancelAnimationFrame(scheduler.rafId);
    }
    if (scheduler.pending || scheduler.rafId !== null) {
      runMultiDragUpdate();
    }
  }, [runMultiDragUpdate]);

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
    // Set dragging state to true when drag starts
    setIsDragging(true);
    const scheduler = dragSchedulerRef.current;
    scheduler.lastApplied = { dx: 0, dy: 0 };

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
    multiDragRef.current = { baseId: id, ...snapshot };
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
    if (multiDragRef.current && multiDragRef.current.startPositions && multiDragRef.current.baseId === id) {
      const start = multiDragRef.current.startPositions.get(id);
      if (!start) return;
      const deltaX = currentPos.x - start.x;
      const deltaY = currentPos.y - start.y;
      scheduleMultiDragUpdate({ dx: deltaX, dy: deltaY });
    }
  };

  const handleDragEnd = (e) => {
    // When drag ends, the new position is in the parent's coordinate system (virtual coordinates)
    const newVirtualPos = {
      x: e.target.x(),
      y: e.target.y(),
    };

    // Set dragging state to false when drag ends
    setIsDragging(false);
    
    // Hide the snap indicator
    setSnapIndicator({
      visible: false,
      position: null,
      elementType: null
    });
    
    // Flush any pending multi-drag updates before finalizing
    flushMultiDragUpdate();

    // The onChange handler (from useElementManager) expects the new virtual position
    onChange(newVirtualPos);
    multiDragRef.current = null;
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
      draggable
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
