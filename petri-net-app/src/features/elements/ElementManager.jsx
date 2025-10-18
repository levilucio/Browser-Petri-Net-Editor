import React from 'react';
import { Layer } from 'react-konva';
import Place from '../../components/Place';
import Transition from '../../components/Transition';
import { usePetriNet } from '../../contexts/PetriNetContext';

const ElementManager = ({
  elements,
  selectedElement,
  handleElementClick,
  handleElementDragEnd,
  enabledTransitionIds,
}) => {
  const { isIdSelected } = usePetriNet();
  return (
    <Layer>
      {/* Places */}
      {elements?.places?.map(place => (
        <Place
          key={place.id}
          {...place}
          isSelected={isIdSelected(place.id, 'place')}
          onSelect={(id) => handleElementClick(place, 'place')}
          onChange={(newAttrs) => handleElementDragEnd(place, 'place', newAttrs)}
        />
      ))}

      {/* Transitions */}
      {elements?.transitions?.map(transition => (
        <Transition
          key={transition.id}
          {...transition}
          isSelected={isIdSelected(transition.id, 'transition')}
          onSelect={(id) => handleElementClick(transition, 'transition')}
          onChange={(newAttrs) => handleElementDragEnd(transition, 'transition', newAttrs)}
          isEnabled={Array.isArray(enabledTransitionIds) ? enabledTransitionIds.includes(transition.id) : false}
        />
      ))}
    </Layer>
  );
};

export default ElementManager;