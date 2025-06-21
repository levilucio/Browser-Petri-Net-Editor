import React from 'react';
import { Layer } from 'react-konva';
import Place from '../../components/Place';
import Transition from '../../components/Transition';

const ElementManager = ({
  elements,
  selectedElement,
  handleElementClick,
  handleElementDragEnd,
  enabledTransitionIds,
}) => {
  return (
    <Layer>
      {/* Places */}
      {elements.places.map(place => (
        <Place
          key={place.id}
          {...place}
          isSelected={selectedElement?.id === place.id}
          onSelect={() => handleElementClick(place, 'place')}
          onChange={(newAttrs) => handleElementDragEnd(place.id, 'places', newAttrs)}
        />
      ))}

      {/* Transitions */}
      {elements.transitions.map(transition => (
        <Transition
          key={transition.id}
          {...transition}
          isSelected={selectedElement?.id === transition.id}
          onSelect={() => handleElementClick(transition, 'transition')}
          onChange={(newAttrs) => handleElementDragEnd(transition.id, 'transitions', newAttrs)}
          isEnabled={Array.isArray(enabledTransitionIds) ? enabledTransitionIds.includes(transition.id) : false}
        />
      ))}
    </Layer>
  );
};

export default ElementManager;