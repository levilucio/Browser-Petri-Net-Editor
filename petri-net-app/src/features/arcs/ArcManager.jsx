import React from 'react';
import { Layer, Arrow, Line, Circle, Group, Text } from 'react-konva';
import { usePetriNet } from '../../contexts/PetriNetContext';
import { useElementManager } from '../elements/useElementManager';
import { useArcManager } from './useArcManager';
import { getArcSourceType, getArcTargetType } from '../../utils/arcTypes';
import { capitalizeTypeNames } from '../../utils/arith-parser';

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
    return elements.places.find(p => p.id === id) || elements.transitions.find(t => t.id === id);
  };

  // Arc source/target type inference centralized in utils/arcTypes

  const getAdjustedPoints = (source, target, anglePoints = []) => {
    const allPoints = [{...source}, ...anglePoints, {...target}];
    const placeRadius = 30; // from Place.jsx
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
      start.x += placeRadius * Math.cos(startAngle);
      start.y += placeRadius * Math.sin(startAngle);
    } else { // transition
        const halfW = transitionWidth / 2;
        const halfH = transitionHeight / 2;
        const absCos = Math.abs(Math.cos(startAngle));
        const absSin = Math.abs(Math.sin(startAngle));
        if (halfW * absSin <= halfH * absCos) {
            start.x += Math.sign(startDx) * halfW;
            start.y += Math.sign(startDx) * halfW * Math.tan(startAngle);
        } else {
            start.x += Math.sign(startDy) * halfH / Math.tan(startAngle);
            start.y += Math.sign(startDy) * halfH;
        }
    }

    let endDx = end.x - p2.x;
    let endDy = end.y - p2.y;
    let endAngle = Math.atan2(endDy, endDx);

    if (target.type === 'place') {
      end.x -= placeRadius * Math.cos(endAngle);
      end.y -= placeRadius * Math.sin(endAngle);
    } else { // transition
        const halfW = transitionWidth / 2;
        const halfH = transitionHeight / 2;
        const absCos = Math.abs(Math.cos(endAngle));
        const absSin = Math.abs(Math.sin(endAngle));
        if (halfW * absSin <= halfH * absCos) {
            end.x -= Math.sign(endDx) * halfW;
            end.y -= Math.sign(endDx) * halfW * Math.tan(endAngle);
        } else {
            end.x -= Math.sign(endDy) * halfH / Math.tan(endAngle);
            end.y -= Math.sign(endDy) * halfH;
        }
    }
    
    const finalPoints = [start.x, start.y];
    anglePoints.forEach(p => finalPoints.push(p.x, p.y));
    finalPoints.push(end.x, end.y);

    return finalPoints;
  };

  return [
    <Layer key="arcs-layer">
      {/* Render existing arcs */}
      {elements?.arcs?.map(arc => {
        const source = getElementById(arc.source);
        const target = getElementById(arc.target);

        if (!source || !target) return null;

        const virtualPoints = getAdjustedPoints(
          { ...source, type: getArcSourceType(arc) },
          { ...target, type: getArcTargetType(arc) },
          arc.anglePoints
        );

        // Midpoint of the arc to position labels
        const midX = (virtualPoints[0] + virtualPoints[virtualPoints.length - 2]) / 2;
        const midY = (virtualPoints[1] + virtualPoints[virtualPoints.length - 1]) / 2;
        const weightOffset = 8; // closer to the arc
        const labelOffset = 14; // vertical offset from the arc (opposite side)

        const isImplicitSelected = selectedElements?.some(se => se.id === arc.id && se.type === 'arc')
          || (selectedElements?.some(se => se.id === source.id) && selectedElements?.some(se => se.id === target.id));
        return (
          <Group key={arc.id}>
            {/* Invisible, wide hit area behind the arrow to make selection easier */}
            <Line
              points={virtualPoints}
              stroke="transparent"
              strokeWidth={24}
              lineCap="round"
              lineJoin="round"
              onClick={(evt) => handleElementClick(evt, arc, 'arc')}
              onTap={(evt) => handleElementClick(evt, arc, 'arc')}
            />
            <Arrow
              points={virtualPoints}
              stroke={(selectedElement?.id === arc.id || isImplicitSelected) ? 'blue' : 'black'}
              strokeWidth={2}
              fill="black"
              pointerLength={10}
              pointerWidth={10}
              hitStrokeWidth={20}
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
                x={midX}
                y={midY + weightOffset}
                text={`${arc.weight}`}
                fontSize={12}
                align="center"
              />
            )}
            {/* Arc label: render on the opposite side of the weight (above the arc) */}
            {arc.label && (
              <Text
                x={midX}
                y={midY - labelOffset}
                text={`${arc.label}`}
                fontSize={12}
                fill="gray"
                align="center"
              />
            )}
            {/* Binding term label (Algebraic-Int mode) */}
            {netMode === 'algebraic-int' && Array.isArray(arc.bindings) && arc.bindings.length > 0 && (
              <Text
                x={midX}
                y={midY - labelOffset + 14}
                text={`${arc.bindings.map(capitalizeTypeNames).join(', ')}`}
                fontSize={12}
                fill="#333"
                align="center"
              />
            )}
          </Group>
        );
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