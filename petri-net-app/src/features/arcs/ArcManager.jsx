import React from 'react';
import { Layer, Arrow, Line, Circle, Group, Text } from 'react-konva';
import { usePetriNet } from '../../contexts/PetriNetContext';
import { useElementManager } from '../elements/useElementManager';
import { useArcManager } from './useArcManager';
import { getArcSourceType, getArcTargetType } from '../../utils/arcTypes';
import { capitalizeTypeNames } from '../../utils/arith-parser';
import { computeAlgebraicPlaceVisuals } from '../../utils/place-layout.js';

const TEXT_CHAR_FACTOR = 0.52;

const measureText = (text = '', fontSize = 12, { padding = 4, maxWidth = Infinity } = {}) => {
  if (!text.length) {
    return { width: 0, wrap: 'none' };
  }
  const estimated = text.length * fontSize * TEXT_CHAR_FACTOR + padding * 2;
  if (estimated <= maxWidth) {
    return { width: estimated, wrap: 'none' };
  }
  return { width: maxWidth, wrap: 'char' };
};

const computeTextWidth = (metrics, fallbackSize) => (metrics.width || fallbackSize * 2);
const isFiniteNumber = (value) => Number.isFinite(value);

const ArcManager = () => {
  const {
    elements,
    selectedElement,
    selectedElements,
    mode,
    tempArcEnd,
    getVirtualPointerPosition,
    gridSnappingEnabled,
    snapToGrid,
    simulationSettings,
  } = usePetriNet();
  const netMode = simulationSettings?.netMode || 'pt';

  const { handleElementClick } = useElementManager();
  const {
    handleAddAnglePoint,
    handleDragAnglePoint,
    handleDeleteAnglePoint,
  } = useArcManager();

  const getElementById = (id) => {
    if (!id || typeof id !== 'string') return null;
    return elements.places.find(p => p.id === id) || elements.transitions.find(t => t.id === id);
  };

  const computePlaceRadius = (place) => {
    if (!place) return 30;
    if (netMode === 'algebraic-int' || Array.isArray(place.valueTokens)) {
      const visuals = computeAlgebraicPlaceVisuals(place.valueTokens, 30);
      if (visuals && typeof visuals.radius === 'number' && Number.isFinite(visuals.radius)) {
        return visuals.radius;
      }
    }
    return 30;
  };

  // Arc source/target type inference centralized in utils/arcTypes

  const getAdjustedPoints = (source, target, anglePoints = []) => {
    // Guard against invalid inputs
    if (!source || !target || typeof source.x !== 'number' || typeof source.y !== 'number' || 
        typeof target.x !== 'number' || typeof target.y !== 'number') {
      return [0, 0, 100, 100]; // Fallback to avoid crashes
    }
    
    const originalSource = { x: source.x, y: source.y };
    const originalTarget = { x: target.x, y: target.y };
    const allPoints = [{ ...source }, ...anglePoints, { ...target }];
    const transitionWidth = 40; // from Transition.jsx
    const transitionHeight = 50; // from Transition.jsx

    const start = { ...allPoints[0] };
    const end = { ...allPoints[allPoints.length - 1] };
    const p1 = allPoints[1] || end;
    const p2 = allPoints[allPoints.length - 2] || start;

    let startDx = p1.x - start.x;
    let startDy = p1.y - start.y;
    let startAngle = Math.atan2(startDy, startDx);

    if (source.type === 'place') {
      const dynamicRadius = computePlaceRadius(source, netMode);
      start.x += dynamicRadius * Math.cos(startAngle);
      start.y += dynamicRadius * Math.sin(startAngle);
    } else { // transition
        const halfW = transitionWidth / 2;
        const halfH = transitionHeight / 2;
        const absCos = Math.abs(Math.cos(startAngle));
        const absSin = Math.abs(Math.sin(startAngle));
        const tanStart = Math.tan(startAngle);
        if (halfW * absSin <= halfH * absCos) {
            start.x += Math.sign(startDx) * halfW;
            start.y += Math.sign(startDx) * halfW * tanStart;
        } else {
            const tanSafe = Math.abs(tanStart) < 1e-6 ? 1e-6 * Math.sign(tanStart || 1) : tanStart;
            start.x += Math.sign(startDy) * halfH / tanSafe;
            start.y += Math.sign(startDy) * halfH;
        }
    }

    let endDx = end.x - p2.x;
    let endDy = end.y - p2.y;
    let endAngle = Math.atan2(endDy, endDx);

    if (target.type === 'place') {
      const dynamicRadius = computePlaceRadius(target, netMode);
      end.x -= dynamicRadius * Math.cos(endAngle);
      end.y -= dynamicRadius * Math.sin(endAngle);
    } else { // transition
        const halfW = transitionWidth / 2;
        const halfH = transitionHeight / 2;
        const absCos = Math.abs(Math.cos(endAngle));
        const absSin = Math.abs(Math.sin(endAngle));
        const tanEnd = Math.tan(endAngle);
        if (halfW * absSin <= halfH * absCos) {
            end.x -= Math.sign(endDx) * halfW;
            end.y -= Math.sign(endDx) * halfW * tanEnd;
        } else {
            const tanSafe = Math.abs(tanEnd) < 1e-6 ? 1e-6 * Math.sign(tanEnd || 1) : tanEnd;
            end.x -= Math.sign(endDy) * halfH / tanSafe;
            end.y -= Math.sign(endDy) * halfH;
        }
    }
    
    const finalPoints = [start.x, start.y];
    anglePoints.forEach(p => finalPoints.push(p.x, p.y));
    finalPoints.push(end.x, end.y);

    const hasFinitePoints = finalPoints.every((value) => Number.isFinite(value));
    if (hasFinitePoints) {
      return finalPoints;
    }

    const fallbackPoints = [originalSource.x, originalSource.y];
    anglePoints.forEach(p => fallbackPoints.push(p.x, p.y));
    fallbackPoints.push(originalTarget.x, originalTarget.y);
    return fallbackPoints;
  };

  return [
    <Layer key="arcs-layer">
          {/* Render existing arcs */}
          {elements?.arcs?.map(arc => {
            // Wrap in try-catch to prevent any errors from crashing the entire app
            try {
              if (!arc || !arc.source || !arc.target) return null;
              
              const source = getElementById(arc.source);
              const target = getElementById(arc.target);

              if (!source || !target) return null;

          const virtualPoints = getAdjustedPoints(
            { ...source, type: getArcSourceType(arc) },
            { ...target, type: getArcTargetType(arc) },
            Array.isArray(arc.anglePoints) ? arc.anglePoints : []
          );

          // Additional guard: ensure virtualPoints is valid before proceeding
          if (!virtualPoints || virtualPoints.length < 4) return null;
          
          // Guard: ensure all virtualPoints are finite numbers
          if (!virtualPoints.every(v => Number.isFinite(v))) return null;

          // Midpoint of the arc to position labels
          const midX = (virtualPoints[0] + virtualPoints[virtualPoints.length - 2]) / 2;
          const midY = (virtualPoints[1] + virtualPoints[virtualPoints.length - 1]) / 2;
          
          // Guard: ensure midpoint is valid
          if (!Number.isFinite(midX) || !Number.isFinite(midY)) return null;
        const weightOffset = 8; // closer to the arc
        const labelOffset = 14; // vertical offset from the arc (opposite side)

        const isImplicitSelected = selectedElements?.some(se => se.id === arc.id && se.type === 'arc')
          || (selectedElements?.some(se => se.id === source.id) && selectedElements?.some(se => se.id === target.id));

        const labelFontSize = 12;
        const weightFontSize = 12;
        const bindingFontSize = 12;

        const arcLabelText = arc.label ? `${arc.label}` : '';
        const weightText = arc.weight > 1 ? `${arc.weight}` : '';
        const bindingText = netMode === 'algebraic-int' && Array.isArray(arc.bindings) && arc.bindings.length > 0
          ? arc.bindings.map(capitalizeTypeNames).join(', ')
          : '';

        const labelMetrics = measureText(arcLabelText, labelFontSize, { padding: 6, maxWidth: 220 });
        const weightMetrics = measureText(weightText, weightFontSize, { padding: 4, maxWidth: 80 });
        const bindingMetrics = measureText(bindingText, bindingFontSize, { padding: 6, maxWidth: 240 });

            const startX = virtualPoints[0];
            const startY = virtualPoints[1];
            const endX = virtualPoints[virtualPoints.length - 2];
            const endY = virtualPoints[virtualPoints.length - 1];

            const dirX = endX - startX;
            const dirY = endY - startY;
            const dirLength = Math.hypot(dirX, dirY);
            let normalX = 0;
            let normalY = -1;
            if (dirLength > 1e-3) {
              normalX = -dirY / dirLength;
              normalY = dirX / dirLength;
            }

            const weightBase = 6;
            const labelBase = 9;
            const bindingGap = 8;
            const bindingScale = 0.66;

            const normalXAbs = Math.abs(normalX);
            const normalYAbs = Math.abs(normalY);

            const computeClearance = (width, fontSize, margin = 4) =>
              (width / 2) * normalXAbs + (fontSize / 2) * normalYAbs + margin;

            const weightWidth = computeTextWidth(weightMetrics, weightFontSize);
            const labelWidth = computeTextWidth(labelMetrics, labelFontSize);
            const bindingWidth = computeTextWidth(bindingMetrics, bindingFontSize);

            const weightDistance = Math.max(weightBase, computeClearance(weightWidth, weightFontSize));
            const labelDistance = Math.max(labelBase, computeClearance(labelWidth, labelFontSize));
            const bindingDistance = Math.max(labelDistance + bindingGap, computeClearance(bindingWidth, bindingFontSize, 6) * bindingScale);

            const weightAnchorX = midX - normalX * weightDistance;
            const weightAnchorY = midY - normalY * weightDistance;
            const labelAnchorX = midX + normalX * labelDistance;
            const labelAnchorY = midY + normalY * labelDistance;
            const bindingAnchorX = midX + normalX * bindingDistance;
            const bindingAnchorY = midY + normalY * bindingDistance;

        if (
          !isFiniteNumber(weightAnchorX) || !isFiniteNumber(weightAnchorY) ||
          !isFiniteNumber(labelAnchorX) || !isFiniteNumber(labelAnchorY) ||
          !isFiniteNumber(bindingAnchorX) || !isFiniteNumber(bindingAnchorY)
        ) {
          return null;
        }

        return (
          <Group key={arc.id}>
            <Arrow
              points={virtualPoints}
              stroke={(selectedElement?.id === arc.id || isImplicitSelected) ? 'blue' : 'black'}
              strokeWidth={2}
              fill="black"
              pointerLength={10}
              pointerWidth={10}
              hitStrokeWidth={12}
              onClick={(evt) => handleElementClick(evt, arc, 'arc')}
              onTap={(evt) => handleElementClick(evt, arc, 'arc')}
              onDblClick={(e) => {
                if (mode === 'arc_angle') {
                  const pos = getVirtualPointerPosition();
                  if (pos) handleAddAnglePoint(arc.id, pos);
                }
              }}
            />
            {/* Weight: render only when > 1, below the arc */}
            {arc.weight > 1 && (
              <Text
                x={weightAnchorX}
                y={weightAnchorY}
                text={weightText}
                fontSize={weightFontSize}
                width={weightWidth}
                offsetX={weightWidth / 2}
                offsetY={weightFontSize / 2}
                align="center"
                listening={false}
              />
            )}
            {/* Arc label: render on the opposite side of the weight (above the arc) */}
            {arc.label && (
              <Text
                x={labelAnchorX}
                y={labelAnchorY}
                text={arcLabelText}
                fontSize={labelFontSize}
                fill="gray"
                width={labelWidth}
                offsetX={labelWidth / 2}
                offsetY={labelFontSize / 2}
                align="center"
                wrap={labelMetrics.wrap}
                ellipsis={labelMetrics.wrap !== 'none'}
                listening={false}
              />
            )}
            {/* Binding term label (Algebraic-Int mode) */}
            {bindingText && (
              <Text
                x={bindingAnchorX}
                y={bindingAnchorY}
                text={bindingText}
                fontSize={bindingFontSize}
                fill="#333"
                width={bindingWidth}
                offsetX={bindingWidth / 2}
                offsetY={bindingFontSize / 2}
                align="center"
                wrap={bindingMetrics.wrap}
                ellipsis={bindingMetrics.wrap !== 'none'}
                listening={false}
              />
            )}
          </Group>
        );
            } catch (err) {
              // Log error but don't crash - skip rendering this arc
              console.warn('[ArcManager] Error rendering arc:', arc?.id, err);
              return null;
            }
      })}

      {/* Render temporary arc for creation */}
      {tempArcEnd && tempArcEnd.sourcePoint && (
        <Line
          points={[tempArcEnd.sourcePoint.x, tempArcEnd.sourcePoint.y, tempArcEnd.x, tempArcEnd.y]}
          stroke="grey"
          strokeWidth={2}
          dash={[5, 5]}
          listening={false}
        />
      )}
    </Layer>,

    // Layer for angle point handles
    <Layer key="handles-layer">
      {selectedElement?.type === 'arc' && mode === 'arc_angle' && (
        selectedElement.anglePoints.map((point, index) => {
          return (
            <Circle
              key={`angle-${selectedElement.id}-${index}`}
              x={point.x}
              y={point.y}
              radius={6}
              fill="red"
              stroke="black"
              strokeWidth={1}
              draggable
              onDragEnd={(e) => {
                const newPos = { x: e.target.x(), y: e.target.y() };
                const finalPos = gridSnappingEnabled ? snapToGrid(newPos.x, newPos.y) : newPos;
                handleDragAnglePoint(selectedElement.id, index, finalPos);
              }}
              onClick={(e) => {
                if (e.evt.button === 2) { // Right-click
                  e.evt.preventDefault();
                  handleDeleteAnglePoint(selectedElement.id, index);
                }
              }}
              onContextMenu={(e) => {
                e.evt.preventDefault();
                handleDeleteAnglePoint(selectedElement.id, index);
              }}
            />
          );
        })
      )}
    </Layer>
  ];
};

export default ArcManager;