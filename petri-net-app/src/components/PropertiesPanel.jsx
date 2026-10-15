import PublicMethodEditor from './panel/PublicMethodEditor';
import React, { useContext } from 'react';
import { PetriNetContext } from '../contexts/PetriNetContext';
import PlaceProperties from './panel/PlaceProperties.jsx';
import ArcBindingsEditor from './panel/ArcBindingsEditor.jsx';
import TransitionGuardEditor from './panel/TransitionGuardEditor.jsx';
import { usePropertiesForm } from './hooks/usePropertiesForm';

const PropertiesPanel = ({ selectedElement, elements, setElements, updateHistory, simulationSettings }) => {
  // Read enabled transitions from context (fallback to defaults if no provider in unit tests)
  const context = useContext(PetriNetContext) || {};
  const enabledTransitionIds = context.enabledTransitionIds || [];
  const isSimulatorReady = context.isSimulatorReady || false;

  const netMode = simulationSettings?.netMode || 'pt';
  const showInferredTypes = Boolean(simulationSettings?.showInferredTypes);

  // Use the extracted form hook
  const {
    formValues,
    setFormValues,
    handleLabelChange,
    handleTokensChange,
    handleWeightChange,
    handleValueTokensBlur,
    handleBindingsBlur,
    handleGuardBlur,
    getElementInfo,
  } = usePropertiesForm({
    selectedElement,
    elements,
    setElements,
    updateHistory,
    netMode,
    showInferredTypes,
  });

  if (!selectedElement) return null;

  const { elementId, elementType } = getElementInfo();

  return (
    <div className="properties-panel w-full px-4 py-2 overflow-y-auto mx-0">
      <h2 className="text-lg font-semibold mb-4">Properties</h2>

      {/* Label */}
        <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
          <input
            type="text"
            value={formValues.label}
            onChange={handleLabelChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="P1, P2, etc."
          />
        </div>

      {elementType === 'transition' && ['algebraic', 'algebraic-int'].includes(netMode) && <PublicMethodEditor
        key={elementId} transition={elements.transitions.find(t => t.id === elementId) || selectedElement}
        elements={elements} setElements={setElements} updateHistory={updateHistory} />}
      {/* Place-specific properties */}
      {selectedElement && elementType === 'place' && (
        <PlaceProperties
          mode={netMode}
          tokens={formValues.tokens}
          valueTokensInput={formValues.valueTokensInput}
          onTokensChange={handleTokensChange}
          onValueTokensChange={(e) => setFormValues(prev => ({ ...prev, valueTokensInput: e.target.value }))}
          onValueTokensBlur={handleValueTokensBlur}
        />
      )}

      {selectedElement && elementType === 'arc' && (
        <ArcBindingsEditor
          mode={netMode}
          weight={formValues.weight}
          bindingsInput={formValues.bindingsInput}
          bindingError={formValues.bindingError}
          onWeightChange={handleWeightChange}
          onBindingsChange={(e) => setFormValues(prev => ({ ...prev, bindingsInput: e.target.value }))}
          onBindingsBlur={handleBindingsBlur}
        />
      )}

      {selectedElement && elementType === 'transition' && ['algebraic', 'algebraic-int'].includes(netMode) && (
        <TransitionGuardEditor
          guardText={formValues.guardText}
          guardError={formValues.guardError}
          onGuardChange={(e) => setFormValues(prev => ({ ...prev, guardText: e.target.value }))}
          onGuardBlur={handleGuardBlur}
        />
      )}
    </div>
  );
};

export default PropertiesPanel;
