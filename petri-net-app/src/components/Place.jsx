import React, { useMemo, useRef, useCallback } from 'react';
import { applyMultiDragDeltaFromSnapshot } from '../features/selection/selection-utils';
import { Circle, Text, Group } from 'react-konva';
import { usePetriNet } from '../contexts/PetriNetContext';
import { useEditorUI } from '../contexts/EditorUIContext';
import { computeAlgebraicPlaceVisuals } from '../utils/place-layout.js';

const Place = ({
  id,
  x,
  y,
  label,
  tokens,
  valueTokens,
  isSelected,
  onSelect,
  onChange,
}) => {
  // Access core editor state from PetriNetContext
  const {
    setIsDragging,
    snapToGrid,
    netMode,
    elements,
    selectedElements,
    setElements,
    multiDragRef,
    isIdSelected,
    setSelection
  } = usePetriNet();

  // Access UI state from EditorUIContext
  const {
    gridSnappingEnabled,
    setSnapIndicator,
  } = useEditorUI();

  const baseRadius = 30;
  const dragSchedulerRef = useRef({
    pending: false,
    rafId: null,
    delta: { dx: 0, dy: 0 },
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
      return applyMultiDragDeltaFromSnapshot(prev, snapshot, scheduler.delta, { gridSnappingEnabled, snapToGrid });
    });
  }, [gridSnappingEnabled, snapToGrid, setElements, multiDragRef]);

  const scheduleMultiDragUpdate = useCallback((delta) => {
    const scheduler = dragSchedulerRef.current;
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
  const isAlgebraicNet = netMode === 'algebraic-int' || Array.isArray(valueTokens);

  const algebraicVisuals = useMemo(() => {
    if (!isAlgebraicNet) {
      return { radius: baseRadius, tokens: [], indicator: null };
    }
    return computeAlgebraicPlaceVisuals(valueTokens || [], baseRadius);
  }, [isAlgebraicNet, valueTokens]);

  const radius = isAlgebraicNet ? algebraicVisuals.radius : baseRadius;

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
    // Initialize multi-drag snapshot
    let selectedNodeIds;
    if (isIdSelected(id, 'place')) {
      selectedNodeIds = new Set(
        selectedElements
          .filter(se => se.type === 'place' || se.type === 'transition')
          .map(se => se.id)
      );
    } else {
      selectedNodeIds = new Set([id]);
      setSelection([{ id, type: 'place' }]);
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
        elementType: 'place'
      });
      e.target.position({ x: snappedPos.x, y: snappedPos.y });
      currentPos = snappedPos;
    }

    // Apply multi-drag delta to other selected nodes and keep arcs attached visually
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

  const renderTokens = () => {
    if (isAlgebraicNet) {
      if (algebraicVisuals.tokens.length > 0) {
        return (
          <>
            {algebraicVisuals.tokens.map(token => (
              <Text
                key={token.key}
                text={token.text}
                fontSize={token.fontSize}
                fill="black"
                x={token.x}
                y={token.y}
                width={token.width}
                align="center"
                wrap="none"
                listening={false}
              />
            ))}
          </>
        );
      }
      if (algebraicVisuals.indicator) {
        return (
          <Text
            text={`(${algebraicVisuals.indicator})`}
            fontSize={12}
            fill="black"
            x={-radius}
            y={-7}
            width={radius * 2}
            align="center"
            wrap="none"
            listening={false}
          />
        );
      }
      return null;
    }
    if (tokens === 0) {
      // For algebraic nets, show nothing when empty regardless of whether valueTokens is defined
      if (netMode === 'algebraic-int' || Array.isArray(valueTokens)) return null;
      return (
        <Text
          text="0"
          fontSize={14}
          fill="black"
          x={-radius}
          y={-7}
          width={radius * 2}
          align="center"
          listening={false}
        />
      );
    }

    if (tokens <= 5) {
      return (
        <>
          {Array.from({ length: tokens }).map((_, index) => {
            const angle = (2 * Math.PI * index) / tokens;
            const tokenRadius = 4;
            const distance = radius / 2;
            const tokenX = Math.cos(angle) * distance;
            const tokenY = Math.sin(angle) * distance;
            return (
              <Circle
                key={index}
                x={tokenX}
                y={tokenY}
                radius={tokenRadius}
                fill="black"
                listening={false}
              />
            );
          })}
          <Text
            text={tokens.toString()}
            fontSize={14}
            fill="black"
            x={-radius}
            y={-7}
            width={radius * 2}
            align="center"
            listening={false}
          />
        </>
      );
    }

    return (
      <Text
        text={tokens.toString()}
        fontSize={16}
        fill="black"
        x={-radius}
        y={-8}
        width={radius * 2}
        align="center"
        listening={false}
      />
    );
  };

  return (
    <Group
      x={x}
      y={y}
      draggable={true}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={() => onSelect(id)}
      onTap={() => onSelect(id)}
      id={id} // Pass id for hit detection in ArcManager
      name='element' // Generic name for easier hit detection
      elementType='place' // Custom attribute for type-specific logic
    >
      <Circle
        radius={radius}
        fill="white"
        stroke={isSelected ? 'blue' : 'black'}
        strokeWidth={2}
      />
      <Text
        text={label}
        fontSize={12}
        fill="black"
        x={-radius}
        y={radius + 5}
        width={radius * 2}
        align="center"
        listening={false}
      />
      {renderTokens()}
    </Group>
  );
};

export default Place;
