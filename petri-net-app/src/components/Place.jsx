import React, { useMemo, useCallback, useRef } from 'react';
import { applyMultiDragDeltaFromSnapshot } from '../features/selection/selection-utils';
import { Circle, Text, Group } from 'react-konva';
import { usePetriNet } from '../contexts/PetriNetContext';
import { useEditorUI } from '../contexts/EditorUIContext';
import { computeAlgebraicPlaceVisuals } from '../utils/place-layout.js';

// Detect touch device - touch events fire much more frequently than mouse
const IS_TOUCH_DEVICE = typeof window !== 'undefined' && 
  ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// Get dynamic throttle based on element count and device type
// Touch devices need more aggressive throttling due to higher event rates (120-240Hz vs 60Hz)
const getThrottleMs = (elementCount) => {
  if (IS_TOUCH_DEVICE) {
    // Mobile: more aggressive throttling
    if (elementCount > 500) return 200;  // 5fps for very large nets
    if (elementCount > 100) return 150;  // ~7fps for large nets
    return 100;                          // 10fps for small nets
  }
  // Desktop: lighter throttling
  if (elementCount > 500) return 100;    // 10fps for very large nets
  return 50;                             // 20fps for normal nets
};

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
    mode,
    arcStart
  } = usePetriNet();

  // Access UI state from EditorUIContext
  const {
    gridSnappingEnabled,
    setSnapIndicator,
  } = useEditorUI();

  const baseRadius = 30;
  
  // Throttle state updates during drag to prevent crashes from vigorous shaking
  const lastDragUpdateRef = useRef(0);
  
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
    // IMPORTANT: If a previous drag's snapshot still exists, clear it first
    // This prevents race conditions when rapidly switching between elements
    if (multiDragRef.current !== null) {
      multiDragRef.current = null;
    }
    
    // Set dragging state to true when drag starts
    setIsDragging(true);

    const alreadySelected = isIdSelected(id, 'place');
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
        elementType: 'place'
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
      draggable={mode !== 'arc' || !arcStart}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onClick={() => onSelect(id)}
      onTap={(e) => {
        // Prevent double firing if onTouchEnd already handled this event
        if (e.evt && e.evt._handledByTouchEnd) return;
        onSelect(id);
      }}
      onTouchEnd={(e) => {
        // On mobile, when creating an arc, touch end should complete the arc
        if (mode === 'arc' && arcStart && arcStart.element.id !== id) {
          onSelect(id);
          // Mark event as handled to prevent onTap from firing and starting a new arc
          if (e.evt) e.evt._handledByTouchEnd = true;
        }
      }}
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
