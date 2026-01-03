import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { usePetriNet } from '../contexts/PetriNetContext';
import { ptValidatePnml, ptValidationInit } from '../features/validation/pt-validation-client';
import { generatePNML } from '../utils/pnml-parser';

/**
 * Property types supported by the PT symbolic execution engine
 * Must match PropertyType in pt_properties.py: "invariant", "exists_coverable", "exists_deadlock"
 */
const PROPERTY_TYPES = [
  { id: 'invariant', label: 'Invariant', description: 'Property must hold in all reachable states' },
  { id: 'exists_coverable', label: 'Exists Coverable', description: 'A marking covering the property is reachable' },
  { id: 'exists_deadlock', label: 'Exists Deadlock', description: 'There exists a reachable deadlock state' },
];

/**
 * Comparison operators for property predicates
 * Note: The PNML parser only supports 'ge' and 'le' in shorthand form
 */
const COMPARISON_OPS = [
  { id: 'ge', label: '≥', xmlTag: 'ge' },
  { id: 'le', label: '≤', xmlTag: 'le' },
];

/**
 * Status display configuration
 */
const STATUS_DISPLAY = {
  holds: { label: 'Holds', color: 'text-green-700 bg-green-100', icon: '✓' },
  violated: { label: 'Violated', color: 'text-red-700 bg-red-100', icon: '✗' },
  witnessed: { label: 'Witnessed', color: 'text-green-700 bg-green-100', icon: '✓' },
  unknown_truncated: { label: 'Unknown (truncated)', color: 'text-yellow-700 bg-yellow-100', icon: '?' },
  unknown_overapprox: { label: 'Unknown (overapprox)', color: 'text-yellow-700 bg-yellow-100', icon: '?' },
  may_violated: { label: 'May Violated', color: 'text-orange-700 bg-orange-100', icon: '~' },
  may_witnessed: { label: 'May Witnessed', color: 'text-orange-700 bg-orange-100', icon: '~' },
};

const ValidationDialog = ({ isOpen, onClose }) => {
  const { elements, simulationSettings } = usePetriNet();
  
  // Properties state: array of user-defined properties
  const [properties, setProperties] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('exact'); // 'exact' or 'km'
  const [maxNodes, setMaxNodes] = useState(50000);
  
  // Get available places from elements
  const places = useMemo(() => elements?.places || [], [elements?.places]);
  
  // Check if net mode is P/T
  const isPTNet = simulationSettings?.netMode === 'pt';
  
  // Load properties and reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setValidationResults(null);
      
      // Load properties from the current net if available (from loaded PNML file)
      if (elements?.properties && Array.isArray(elements.properties) && elements.properties.length > 0) {
        // Convert loaded properties to dialog format (already compatible from parser)
        setProperties(elements.properties);
      }
      
      // Pre-warm the worker
      ptValidationInit().catch(err => {
        console.warn('[ValidationDialog] Worker prewarm failed:', err);
      });
    }
  }, [isOpen, elements?.properties]);
  
  // Add a new property
  const addProperty = useCallback((type) => {
    const newProp = {
      id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      name: `${type}_${properties.length + 1}`,
      predicates: type === 'exists_deadlock' ? [] : [{ placeId: places[0]?.id || '', op: 'ge', value: 1 }],
    };
    setProperties(prev => [...prev, newProp]);
  }, [properties.length, places]);
  
  // Remove a property
  const removeProperty = useCallback((propId) => {
    setProperties(prev => prev.filter(p => p.id !== propId));
  }, []);
  
  // Update a property
  const updateProperty = useCallback((propId, updates) => {
    setProperties(prev => prev.map(p => p.id === propId ? { ...p, ...updates } : p));
  }, []);
  
  // Add a predicate to a property
  const addPredicate = useCallback((propId) => {
    setProperties(prev => prev.map(p => {
      if (p.id !== propId) return p;
      return {
        ...p,
        predicates: [...p.predicates, { placeId: places[0]?.id || '', op: 'ge', value: 1 }],
      };
    }));
  }, [places]);
  
  // Remove a predicate from a property
  const removePredicate = useCallback((propId, predIdx) => {
    setProperties(prev => prev.map(p => {
      if (p.id !== propId) return p;
      return {
        ...p,
        predicates: p.predicates.filter((_, i) => i !== predIdx),
      };
    }));
  }, []);
  
  // Update a predicate
  const updatePredicate = useCallback((propId, predIdx, updates) => {
    setProperties(prev => prev.map(p => {
      if (p.id !== propId) return p;
      return {
        ...p,
        predicates: p.predicates.map((pred, i) => i === predIdx ? { ...pred, ...updates } : pred),
      };
    }));
  }, []);
  
  // Build PNML with embedded properties
  // Uses the same format as existing files in pn_examples/bench and pn_examples/pt
  const buildPnmlWithProperties = useCallback(() => {
    // Export current net to PNML - merge elements with netMode from simulationSettings
    const petriNetJson = {
      ...elements,
      netMode: simulationSettings?.netMode || 'pt',
    };
    const basePnml = generatePNML(petriNetJson);
    
    if (properties.length === 0) {
      return basePnml;
    }
    
    // Escape XML special characters in attribute values
    const escapeXml = (str) => String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    
    // Build toolspecific XML for properties in the existing format
    const propsXml = properties.map(prop => {
      // For exists_deadlock, no predicate element
      if (prop.type === 'exists_deadlock') {
        return `
        <property id="${escapeXml(prop.id)}" name="${escapeXml(prop.name)}" type="${prop.type}" severity="error"/>`;
      }
      
      // Build predicate content - each condition is <ge place="..." k="..."/> or <le .../>
      const conditions = prop.predicates.map(pred => {
        const place = places.find(p => p.id === pred.placeId);
        const placeName = place?.name || place?.id || pred.placeId;
        const opTag = pred.op === 'le' ? 'le' : 'ge'; // Default to ge
        return `<${opTag} place="${escapeXml(placeName)}" k="${pred.value}"/>`;
      });
      
      // Wrap in <and> if multiple conditions, otherwise just the single condition
      let predicateContent;
      if (conditions.length === 0) {
        // No predicates - shouldn't happen but handle gracefully
        predicateContent = '<ge place="" k="0"/>';
      } else if (conditions.length === 1) {
        predicateContent = conditions[0];
      } else {
        predicateContent = `<and>\n              ${conditions.join('\n              ')}\n            </and>`;
      }
      
      return `
        <property id="${escapeXml(prop.id)}" name="${escapeXml(prop.name)}" type="${prop.type}" severity="error">
          <predicate>${predicateContent}</predicate>
        </property>`;
    }).join('');
    
    const toolspecificXml = `
    <toolspecific tool="Browser-Petri-Net-Editor" version="1">
      <properties>${propsXml}
      </properties>
    </toolspecific>`;
    
    // Insert toolspecific before </net>
    const insertPos = basePnml.lastIndexOf('</net>');
    if (insertPos === -1) {
      console.error('[ValidationDialog] Could not find </net> in PNML');
      return basePnml;
    }
    
    return basePnml.slice(0, insertPos) + toolspecificXml + '\n  ' + basePnml.slice(insertPos);
  }, [elements, simulationSettings, properties, places]);
  
  // Run validation
  const handleValidate = useCallback(async () => {
    setIsValidating(true);
    setError(null);
    setValidationResults(null);
    
    try {
      const pnml = buildPnmlWithProperties();
      console.log('[ValidationDialog] Starting validation with mode:', mode, 'maxNodes:', maxNodes);
      
      const results = await ptValidatePnml(pnml, { mode, maxNodes, maxSteps: maxNodes * 4 });
      console.log('[ValidationDialog] Validation complete:', results);
      
      setValidationResults(results);
    } catch (err) {
      console.error('[ValidationDialog] Validation failed:', err);
      setError(err.message || String(err));
    } finally {
      setIsValidating(false);
    }
  }, [buildPnmlWithProperties, mode, maxNodes]);
  
  if (!isOpen) return null;
  
  // Show warning if not a P/T net
  if (!isPTNet) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">P/T Net Validation</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">×</button>
          </div>
          <div className="text-center py-8">
            <div className="text-yellow-600 text-4xl mb-4">⚠️</div>
            <p className="text-gray-700 mb-2">Validation is only available for P/T nets.</p>
            <p className="text-gray-500 text-sm">Please switch to P/T net mode in Settings to use this feature.</p>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[700px] max-w-[95vw] max-h-[90vh] mx-4 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">P/T Net Validation</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl font-bold">×</button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Validation Settings */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Exploration Settings</h3>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Mode:</span>
                <select
                  value={mode}
                  onChange={e => setMode(e.target.value)}
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="exact">Exact</option>
                  <option value="km">Karp-Miller (ω-abstraction)</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-sm text-gray-600">Max nodes:</span>
                <input
                  type="number"
                  value={maxNodes}
                  onChange={e => setMaxNodes(Math.max(100, parseInt(e.target.value) || 50000))}
                  className="border rounded px-2 py-1 text-sm w-24"
                  min={100}
                  max={500000}
                />
              </label>
            </div>
          </div>
          
          {/* Property Categories */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Add Property</h3>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map(pt => (
                <button
                  key={pt.id}
                  onClick={() => addProperty(pt.id)}
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors"
                  title={pt.description}
                >
                  + {pt.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Properties List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Properties ({properties.length})
            </h3>
            
            {properties.length === 0 ? (
              <div className="text-gray-500 text-sm italic py-4 text-center border border-dashed border-gray-300 rounded">
                No properties defined. Click a button above to add one.
              </div>
            ) : (
              properties.map(prop => {
                const propType = PROPERTY_TYPES.find(pt => pt.id === prop.type);
                return (
                  <div key={prop.id} className="border rounded-lg p-3 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase text-gray-500">{propType?.label}</span>
                        <input
                          type="text"
                          value={prop.name}
                          onChange={e => updateProperty(prop.id, { name: e.target.value })}
                          className="border-b border-gray-300 focus:border-blue-500 outline-none px-1 text-sm font-medium"
                          placeholder="Property name"
                        />
                      </div>
                      <button
                        onClick={() => removeProperty(prop.id)}
                        className="text-red-500 hover:text-red-700 text-sm"
                        title="Remove property"
                      >
                        ✕
                      </button>
                    </div>
                    
                    {/* Predicates */}
                    {prop.type !== 'exists_deadlock' && (
                      <div className="space-y-2 ml-2">
                        {prop.predicates.map((pred, predIdx) => (
                          <div key={predIdx} className="flex items-center gap-2 text-sm">
                            {predIdx > 0 && <span className="text-gray-500 font-medium">AND</span>}
                            <select
                              value={pred.placeId}
                              onChange={e => updatePredicate(prop.id, predIdx, { placeId: e.target.value })}
                              className="border rounded px-2 py-1"
                            >
                              <option value="">-- Select Place --</option>
                              {places.map(place => (
                                <option key={place.id} value={place.id}>
                                  {place.name || place.id}
                                </option>
                              ))}
                            </select>
                            <select
                              value={pred.op}
                              onChange={e => updatePredicate(prop.id, predIdx, { op: e.target.value })}
                              className="border rounded px-2 py-1 w-16 text-center"
                            >
                              {COMPARISON_OPS.map(op => (
                                <option key={op.id} value={op.id}>{op.label}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={pred.value}
                              onChange={e => updatePredicate(prop.id, predIdx, { value: parseInt(e.target.value) || 0 })}
                              className="border rounded px-2 py-1 w-16"
                              min={0}
                            />
                            {prop.predicates.length > 1 && (
                              <button
                                onClick={() => removePredicate(prop.id, predIdx)}
                                className="text-gray-400 hover:text-red-500"
                                title="Remove predicate"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => addPredicate(prop.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 ml-2"
                        >
                          + Add condition
                        </button>
                      </div>
                    )}
                    
                    {prop.type === 'exists_deadlock' && (
                      <div className="text-gray-500 text-sm italic ml-2">
                        No conditions needed — checks for any deadlock state.
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          
          {/* Results */}
          {validationResults && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Results</h3>
              
              {/* Stats */}
              <div className="bg-gray-50 p-3 rounded-lg mb-3 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div><span className="text-gray-500">Mode:</span> {validationResults.stats?.mode}</div>
                  <div><span className="text-gray-500">Nodes:</span> {validationResults.stats?.nodes?.toLocaleString()}</div>
                  <div><span className="text-gray-500">Edges:</span> {validationResults.stats?.edges?.toLocaleString()}</div>
                  <div><span className="text-gray-500">Time:</span> {(validationResults.stats?.total_s * 1000).toFixed(1)}ms</div>
                </div>
                {validationResults.stats?.truncated && (
                  <div className="text-yellow-600 mt-2">⚠️ Exploration was truncated (max nodes reached)</div>
                )}
              </div>
              
              {/* Property Results */}
              {validationResults.properties?.length > 0 ? (
                <div className="space-y-2">
                  {validationResults.properties.map((propResult, idx) => {
                    const statusInfo = STATUS_DISPLAY[propResult.status] || { label: propResult.status, color: 'text-gray-700 bg-gray-100', icon: '?' };
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded">
                        <span className="font-medium text-sm">{propResult.name || propResult.id}</span>
                        <span className={`px-2 py-0.5 rounded text-sm font-medium ${statusInfo.color}`}>
                          {statusInfo.icon} {statusInfo.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-gray-500 text-sm italic">No property results returned.</div>
              )}
            </div>
          )}
          
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t bg-gray-50">
          <div className="text-xs text-gray-500">
            {places.length} places available
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                isValidating
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isValidating ? 'Validating...' : 'Validate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValidationDialog;
