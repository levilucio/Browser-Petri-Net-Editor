import React, { useState, useEffect, useMemo } from 'react';
import { usePetriNet } from '../contexts/PetriNetContext';
import { generateTestSuite } from '../satel/core/TestGenerator';
import { executeTestSuite } from '../satel/core/TestExecutor';
import { 
  generateExecutionReport,
  extractInterface,
  validateInterface
} from '../satel';
import { AlgebraicSimulator } from '../features/simulation/algebraic-simulator';
import IntentionEditorV2 from './IntentionEditorV2';

const SatelPanel = ({ isOpen, onClose }) => {
  const { elements, simulationSettings } = usePetriNet();
  const [testIntentions, setTestIntentions] = useState([]);
  const [testSuite, setTestSuite] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIntention, setSelectedIntention] = useState(null);
  const [editingIntention, setEditingIntention] = useState(null);
  const [activeTab, setActiveTab] = useState('intentions'); // 'intentions', 'results', 'interface'
  const [generationProgress, setGenerationProgress] = useState(null);
  const [generationWorker, setGenerationWorker] = useState(null);
  const [generationTimeout, setGenerationTimeout] = useState(null);

  const isAlgebraicMode = simulationSettings?.netMode === 'algebraic-int';

  // Load test intentions from localStorage when panel opens (for Manufacturing example)
  useEffect(() => {
    if (isOpen && isAlgebraicMode) {
      try {
        const stored = localStorage.getItem('satel-test-intentions');
        if (stored) {
          const intentions = JSON.parse(stored);
          if (Array.isArray(intentions) && intentions.length > 0) {
            setTestIntentions(intentions);
            // Clear after loading so it doesn't interfere with other nets
            localStorage.removeItem('satel-test-intentions');
          }
        }
      } catch (e) {
        console.warn('Could not load stored test intentions:', e);
      }
    }
  }, [isOpen, isAlgebraicMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (generationWorker) {
        generationWorker.terminate();
      }
      if (generationTimeout) {
        clearTimeout(generationTimeout);
      }
    };
  }, [generationWorker, generationTimeout]);

  // Extract I/O interface from current net
  const ioInterface = useMemo(() => {
    if (!isAlgebraicMode) return null;
    try {
      const iface = extractInterface(elements);
      const validation = validateInterface(elements);
      return { ...iface, validation };
    } catch (err) {
      return null;
    }
  }, [elements, isAlgebraicMode]);

  const handleCancelGeneration = () => {
    if (generationWorker) {
      generationWorker.postMessage({ type: 'CANCEL' });
      generationWorker.terminate();
      setGenerationWorker(null);
    }
    if (generationTimeout) {
      clearTimeout(generationTimeout);
      setGenerationTimeout(null);
    }
    setIsGenerating(false);
    setGenerationProgress(null);
    setError('Test generation cancelled');
  };

  const handleGenerateTests = async () => {
    if (testIntentions.length === 0) {
      setError('No test intentions defined. Create at least one test intention first.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerationProgress({ current: 0, total: testIntentions.length, message: 'Starting...' });
    
    try {
      console.log('[SATEL] Starting test generation with', testIntentions.length, 'intentions');
      
      // Check if all intentions are V2 format
      const hasV2Intentions = testIntentions.some(intention => 
        intention.variables && intention.pairs
      );
      
      const petriNet = {
        places: elements.places,
        transitions: elements.transitions,
        arcs: elements.arcs,
        mode: 'algebraic',
        adtDefinitions: elements.adtDefinitions || elements.places[0]?.adtDefinitions
      };

      console.log('[SATEL] Petri net:', petriNet.places.length, 'places,', petriNet.transitions.length, 'transitions');
      console.log('[SATEL] Has V2 intentions:', hasV2Intentions);
      
      // Check if we're in demo mode (Z3 not available)
      const demoMode = window.location.search.includes('satel-demo=true');
      
      let suite;
      if (demoMode) {
        console.log('[SATEL] Demo mode: generating mock test suite');
        // Simulate progress
        for (let i = 0; i < testIntentions.length; i++) {
          setGenerationProgress({ 
            current: i + 1, 
            total: testIntentions.length, 
            message: `Processing intention ${i + 1}/${testIntentions.length}` 
          });
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        suite = {
          metadata: {
            generatedAt: new Date().toISOString(),
            intentionCount: testIntentions.length,
            totalTestCases: testIntentions.length * 3,
            coverageAnalysis: {
              transitionCoverage: 0.85,
              pathCoverage: 0.75
            }
          },
          testCases: testIntentions.flatMap((intention, idx) => [
            {
              id: `tc-${idx}-1`,
              intentionId: intention.id,
              intentionName: intention.name,
              path: [`receiveOrder`, `scheduleJob`, `startCutting`],
              initialMarking: {},
              inputBindings: {},
              expectedOutput: {},
              oracleType: 'positive'
            },
            {
              id: `tc-${idx}-2`,
              intentionId: intention.id,
              intentionName: intention.name,
              path: [`completeAssembly`, `qualityCheck`, `passQualityCheck`],
              initialMarking: {},
              inputBindings: {},
              expectedOutput: {},
              oracleType: 'positive'
            },
            {
              id: `tc-${idx}-3`,
              intentionId: intention.id,
              intentionName: intention.name,
              path: [`failQualityCheck`, `rework`, `qualityCheck`],
              initialMarking: {},
              inputBindings: {},
              expectedOutput: {},
              oracleType: 'negative'
            }
          ])
        };
      } else {
        // Real generation with optimized settings
        console.log('[SATEL] Real mode: using optimized generation with shared graph caching');
        
        const limits = {
          maxStates: 300,  // Increased from 200 (graph is cached now)
          maxDepth: 25,    // Increased from 20  
          maxPathsPerIntention: 15,  // Increased from 10
          applyReduction: true,
          timeout: 90000  // 90 second timeout (more generous now that it's faster)
        };
        
        // Set overall timeout
        const timeoutId = setTimeout(() => {
          handleCancelGeneration();
          setError('Test generation timed out after 60 seconds. Try reducing the number of test intentions or simplifying the Petri net.');
        }, limits.timeout);
        setGenerationTimeout(timeoutId);
        
        // Use optimized generation with shared graph caching
        const { generateTestSuite } = await import('../satel/index.js');
        const { AlgebraicSimulator } = await import('../features/simulation/algebraic-simulator.js');
        const simulator = new AlgebraicSimulator();
        
        // Progress callback for real-time updates
        const progressCallback = (progress) => {
          setGenerationProgress({
            current: progress.current || 0,
            total: progress.total || testIntentions.length,
            message: progress.message || 'Processing...'
          });
        };
        
        // Generate entire suite (uses shared graph caching internally)
        // Skip reachability graph for V2 intentions
        suite = await generateTestSuite(
          testIntentions,
          petriNet,
          simulator,
          {
            ...limits,
            maxStates: hasV2Intentions ? 0 : limits.maxStates,
            maxDepth: hasV2Intentions ? 0 : limits.maxDepth,
            applyReduction: !hasV2Intentions,
            onProgress: progressCallback
          }
        );
        
        clearTimeout(timeoutId);
        setGenerationTimeout(null);
      }

      console.log('[SATEL] Test suite generated:', suite);
      
      // Regression check: Verify suite has valid data
      if (suite) {
        console.log('[SATEL] Suite validation:');
        console.log(`  Test cases: ${suite.testCases?.length || 0}`);
        console.log(`  Intentions processed: ${suite.statistics?.intentionsProcessed || 0}/${suite.statistics?.totalIntentions || 0}`);
        console.log(`  States explored: ${suite.statistics?.statesExplored || 0}`);
        console.log(`  Reduction applied: ${suite.statistics?.reductionApplied ? 'Yes' : 'No'}`);
        
        // Assert non-zero results for non-demo mode
        if (!demoMode) {
          if ((suite.testCases?.length || 0) === 0) {
            console.error('[SATEL] ERROR: Generated 0 test cases in real mode!');
          }
          if ((suite.statistics?.statesExplored || 0) === 0) {
            console.error('[SATEL] ERROR: Explored 0 states in real mode!');
          }
          if ((suite.statistics?.totalIntentions || 0) === 0) {
            console.error('[SATEL] ERROR: totalIntentions is 0!');
          }
        }
      }
      
      setTestSuite(suite);
      setActiveTab('results');
      setGenerationProgress(null);
      console.log('[SATEL] Switched to results tab');
    } catch (err) {
      console.error('[SATEL] Test generation error:', err);
      setError(`Failed to generate tests: ${err.message}`);
      setGenerationProgress(null);
    } finally {
      if (generationTimeout) {
        clearTimeout(generationTimeout);
        setGenerationTimeout(null);
      }
      setIsGenerating(false);
    }
  };

  const handleExecuteTests = async () => {
    if (!testSuite) {
      setError('No test suite generated. Generate tests first.');
      return;
    }

    setIsExecuting(true);
    setError(null);

    try {
      const demoMode = window.location.search.includes('satel-demo=true');
      
      let results;
      if (demoMode) {
        console.log('[SATEL] Demo mode: generating mock test results');
        // Create mock test results for demo
        const passedCount = Math.floor(testSuite.testCases.length * 0.87);
        results = {
          summary: {
            total: testSuite.testCases.length,
            passed: passedCount,
            failed: testSuite.testCases.length - passedCount,
            executionTimeMs: 1500
          },
          testCaseResults: testSuite.testCases.map((tc, idx) => ({
            testCaseId: tc.id,
            intentionName: tc.intentionName,
            status: idx < passedCount ? 'passed' : 'failed',
            executionTimeMs: 50 + Math.random() * 100,
            oracleResult: idx < passedCount ? 'pass' : 'fail',
            actualOutput: {},
            coverageContribution: {
              transitions: ['t1', 't2'],
              paths: 1
            }
          }))
        };
      } else {
        const simulator = new AlgebraicSimulator();
        const petriNet = {
          places: elements.places,
          transitions: elements.transitions,
          arcs: elements.arcs,
          mode: 'algebraic',
          adtDefinitions: elements.adtDefinitions || elements.places[0]?.adtDefinitions
        };
        results = await executeTestSuite(testSuite, petriNet, simulator);
      }
      
      setTestResults(results);
    } catch (err) {
      setError(`Failed to execute tests: ${err.message}`);
      console.error('Test execution error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCreateIntention = () => {
    const newIntention = {
      id: `intention-${Date.now()}`,
      name: 'New Test Intention',
      description: '',
      pathPattern: {
        type: 'sequence',
        events: []
      },
      inputConstraints: [],
      outputExpectations: [],
      oracleType: 'positive'
    };
    setEditingIntention(newIntention);
  };
  
  const handleCreateIntentionV2 = () => {
    const newIntention = {
      id: `intention-v2-${Date.now()}`,
      name: 'New V2 Test Intention',
      description: '',
      testType: 'positive',
      variables: [],
      pairs: []
    };
    setEditingIntention(newIntention);
  };

  const handleSaveIntention = () => {
    if (!editingIntention) return;

    const existing = testIntentions.find(i => i.id === editingIntention.id);
    if (existing) {
      setTestIntentions(testIntentions.map(i => 
        i.id === editingIntention.id ? editingIntention : i
      ));
    } else {
      setTestIntentions([...testIntentions, editingIntention]);
    }
    setEditingIntention(null);
  };

  const handleDeleteIntention = (id) => {
    setTestIntentions(testIntentions.filter(i => i.id !== id));
    if (selectedIntention?.id === id) {
      setSelectedIntention(null);
    }
  };

  if (!isOpen) return null;

  if (!isAlgebraicMode) {
    return (
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">SATEL Testing</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        <div className="p-6 text-center text-gray-600">
          <p className="mb-2">SATEL testing is only available for Algebraic Petri Nets.</p>
          <p className="text-sm">Switch to Algebraic mode in Settings to use SATEL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[500px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">SATEL Testing</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 text-xl"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'intentions' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
          onClick={() => setActiveTab('intentions')}
        >
          Test Intentions ({testIntentions.length})
        </button>
        <button
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'interface' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
          onClick={() => setActiveTab('interface')}
        >
          I/O Interface
        </button>
        <button
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'results' 
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }`}
          onClick={() => setActiveTab('results')}
        >
          Results
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'intentions' && (
          <IntentionsTab
            testIntentions={testIntentions}
            selectedIntention={selectedIntention}
            editingIntention={editingIntention}
            onSelectIntention={setSelectedIntention}
            onCreateIntention={handleCreateIntention}
            onEditIntention={setEditingIntention}
            onSaveIntention={handleSaveIntention}
            onDeleteIntention={handleDeleteIntention}
            onCancelEdit={() => setEditingIntention(null)}
            elements={elements}
          />
        )}
        
        {activeTab === 'interface' && (
          <InterfaceTab ioInterface={ioInterface} />
        )}
        
        {activeTab === 'results' && (
          <ResultsTab 
            testSuite={testSuite}
            testResults={testResults}
            isGenerating={isGenerating}
            isExecuting={isExecuting}
          />
        )}
      </div>

      {/* Action Buttons */}
      {activeTab === 'intentions' && !editingIntention && (
        <div className="p-4 border-t border-gray-200 space-y-2">
          {isGenerating ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-700">
                <span>
                  {generationProgress 
                    ? `${generationProgress.current}/${generationProgress.total}: ${generationProgress.message}` 
                    : 'Generating...'}
                </span>
              </div>
              {generationProgress && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                  />
                </div>
              )}
              <button
                onClick={handleCancelGeneration}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Cancel Generation
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateTests}
              disabled={testIntentions.length === 0}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              Generate Test Suite
            </button>
          )}
          {testSuite && (
            <button
              onClick={handleExecuteTests}
              disabled={isExecuting}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            >
              {isExecuting ? 'Executing...' : `Execute Tests (${testSuite.testCases.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Intentions Tab Component
const IntentionsTab = ({ 
  testIntentions, 
  selectedIntention,
  editingIntention,
  onSelectIntention,
  onCreateIntention,
  onCreateIntentionV2,
  onEditIntention,
  onSaveIntention,
  onDeleteIntention,
  onCancelEdit,
  elements
}) => {
  if (editingIntention) {
    return (
      <IntentionEditor
        intention={editingIntention}
        onChange={onEditIntention}
        onSave={onSaveIntention}
        onCancel={onCancelEdit}
        elements={elements}
      />
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={onCreateIntention}
          className="px-4 py-3 bg-blue-50 text-blue-600 border-2 border-dashed border-blue-300 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
        >
          + Create V1 Intention
        </button>
        <button
          onClick={onCreateIntentionV2}
          className="px-4 py-3 bg-purple-50 text-purple-600 border-2 border-dashed border-purple-300 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
        >
          + Create V2 Intention
        </button>
      </div>

      {testIntentions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          <p>No test intentions yet.</p>
          <p>Create one to start testing your Petri net.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {testIntentions.map(intention => (
            <div
              key={intention.id}
              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                selectedIntention?.id === intention.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => onSelectIntention(intention)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm text-gray-800">{intention.name}</h3>
                  {isV2Intention(intention) && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded font-medium">
                      V2
                    </span>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  (intention.testType === 'positive' || intention.oracleType === 'positive')
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {intention.testType || intention.oracleType}
                </span>
              </div>
              {intention.description && (
                <p className="text-xs text-gray-600 mb-2">{intention.description}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {isV2Intention(intention) ? (
                  <>
                    <span>{intention.variables?.length || 0} variables</span>
                    <span>•</span>
                    <span>{intention.pairs?.length || 0} pairs</span>
                  </>
                ) : (
                  <>
                    <span>{intention.pathPattern?.events?.length || 0} events</span>
                    <span>•</span>
                    <span>{intention.inputConstraints?.length || 0} inputs</span>
                    <span>•</span>
                    <span>{intention.outputExpectations?.length || 0} outputs</span>
                  </>
                )}
              </div>
              {selectedIntention?.id === intention.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditIntention(intention);
                    }}
                    className="flex-1 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${intention.name}"?`)) {
                        onDeleteIntention(intention.id);
                      }
                    }}
                    className="flex-1 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Detect if intention is V2 format
const isV2Intention = (intention) => {
  return intention && intention.variables && intention.pairs;
};

// Intention Editor Component (dispatcher)
const IntentionEditor = ({ intention, onChange, onSave, onCancel, elements }) => {
  // Detect format and use appropriate editor
  if (isV2Intention(intention)) {
    return (
      <IntentionEditorV2
        intention={intention}
        onChange={onChange}
        onSave={onSave}
        onCancel={onCancel}
        elements={elements}
      />
    );
  }
  
  // V1 editor
  return (
    <IntentionEditorV1
      intention={intention}
      onChange={onChange}
      onSave={onSave}
      onCancel={onCancel}
      elements={elements}
    />
  );
};

// V1 Intention Editor Component
const IntentionEditorV1 = ({ intention, onChange, onSave, onCancel, elements }) => {
  const transitions = elements.transitions || [];
  const places = elements.places || [];

  const updateIntention = (field, value) => {
    onChange({ ...intention, [field]: value });
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        {intention.name === 'New Test Intention' ? 'Create Test Intention' : 'Edit Test Intention'}
      </h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input
          type="text"
          value={intention.name}
          onChange={(e) => updateIntention('name', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Test intention name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={intention.description}
          onChange={(e) => updateIntention('description', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="Describe what this test checks..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Oracle Type</label>
        <select
          value={intention.oracleType}
          onChange={(e) => updateIntention('oracleType', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="positive">Positive (expected behavior)</option>
          <option value="negative">Negative (forbidden behavior)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Event Sequence
          <span className="ml-2 text-xs text-gray-500">
            (Transitions to fire in order)
          </span>
        </label>
        <div className="space-y-2">
          {intention.pathPattern.events.map((event, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <span className="text-xs text-gray-500 w-6">{idx + 1}.</span>
              <select
                value={event.transition}
                onChange={(e) => {
                  const newEvents = [...intention.pathPattern.events];
                  newEvents[idx] = { ...event, transition: e.target.value };
                  updateIntention('pathPattern', { ...intention.pathPattern, events: newEvents });
                }}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs"
              >
                <option value="">Select transition...</option>
                {transitions.map(t => (
                  <option key={t.id} value={t.id}>{t.label || t.id}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  const newEvents = intention.pathPattern.events.filter((_, i) => i !== idx);
                  updateIntention('pathPattern', { ...intention.pathPattern, events: newEvents });
                }}
                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-xs"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const newEvents = [...intention.pathPattern.events, { transition: '', binding: {} }];
              updateIntention('pathPattern', { ...intention.pathPattern, events: newEvents });
            }}
            className="w-full px-3 py-2 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-gray-600 text-xs hover:bg-gray-100"
          >
            + Add Event
          </button>
        </div>
      </div>

      <div className="pt-4 border-t flex gap-2">
        <button
          onClick={onSave}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// Interface Tab Component
const InterfaceTab = ({ ioInterface }) => {
  if (!ioInterface) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Unable to extract I/O interface.</p>
      </div>
    );
  }

  const { inputPlaces, outputPlaces, inputTransitions, outputTransitions, validation } = ioInterface;

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Validation</h3>
        {validation.valid ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            ✓ I/O interface is valid
          </div>
        ) : (
          <div className="space-y-2">
            {validation.errors?.map((err, idx) => (
              <div key={idx} className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs">
                {err}
              </div>
            ))}
            {validation.warnings?.map((warn, idx) => (
              <div key={idx} className="p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-xs">
                {warn}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Input Places ({inputPlaces.length})</h3>
        {inputPlaces.length === 0 ? (
          <p className="text-xs text-gray-500">No input places marked</p>
        ) : (
          <div className="space-y-1">
            {inputPlaces.map(p => (
              <div key={p.id} className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm">
                {p.label || p.id}
                {p.io_description && (
                  <span className="ml-2 text-xs text-gray-600">- {p.io_description}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Output Places ({outputPlaces.length})</h3>
        {outputPlaces.length === 0 ? (
          <p className="text-xs text-gray-500">No output places marked</p>
        ) : (
          <div className="space-y-1">
            {outputPlaces.map(p => (
              <div key={p.id} className="px-3 py-2 bg-green-50 border border-green-200 rounded text-sm">
                {p.label || p.id}
                {p.io_description && (
                  <span className="ml-2 text-xs text-gray-600">- {p.io_description}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Input Transitions ({inputTransitions.length})</h3>
        {inputTransitions.length === 0 ? (
          <p className="text-xs text-gray-500">No input transitions marked</p>
        ) : (
          <div className="space-y-1">
            {inputTransitions.map(t => (
              <div key={t.id} className="px-3 py-2 bg-blue-50 border border-blue-200 rounded text-sm">
                {t.label || t.id}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Output Transitions ({outputTransitions.length})</h3>
        {outputTransitions.length === 0 ? (
          <p className="text-xs text-gray-500">No output transitions marked</p>
        ) : (
          <div className="space-y-1">
            {outputTransitions.map(t => (
              <div key={t.id} className="px-3 py-2 bg-green-50 border border-green-200 rounded text-sm">
                {t.label || t.id}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Results Tab Component
const ResultsTab = ({ testSuite, testResults, isGenerating, isExecuting }) => {
  if (isGenerating) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>Generating test suite...</p>
      </div>
    );
  }

  if (!testSuite) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p>No test suite generated yet.</p>
        <p className="text-sm mt-2">Create test intentions and click "Generate Test Suite".</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Test Suite Statistics</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600">Test Cases:</span>
            <span className="ml-2 font-semibold">{testSuite.testCases?.length || 0}</span>
          </div>
          <div>
            <span className="text-gray-600">Intentions:</span>
            <span className="ml-2 font-semibold">{testSuite.statistics?.totalIntentions || 0}</span>
          </div>
          <div>
            <span className="text-gray-600">States Explored:</span>
            <span className="ml-2 font-semibold">{testSuite.statistics?.statesExplored || 0}</span>
          </div>
          <div>
            <span className="text-gray-600">Reduction:</span>
            <span className="ml-2 font-semibold">{testSuite.statistics?.reductionApplied ? 'Yes' : 'No'}</span>
          </div>
        </div>
      </div>

      {testResults && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Execution Results</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Tests:</span>
              <span className="font-semibold">{testResults.statistics?.total || testResults.totalTests || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-600">Passed:</span>
              <span className="font-semibold text-green-600">{testResults.statistics?.passed || testResults.passed || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-red-600">Failed:</span>
              <span className="font-semibold text-red-600">{testResults.statistics?.failed || testResults.failed || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-yellow-600">Errors:</span>
              <span className="font-semibold text-yellow-600">{testResults.statistics?.errors || testResults.errors || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Execution Time:</span>
              <span className="font-semibold">{testResults.statistics?.executionTime || 0}ms</span>
            </div>
          </div>
          {(testResults.statistics?.passed === testResults.statistics?.total || 
            testResults.passed === testResults.totalTests) && (
            <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded text-green-700 text-sm text-center font-medium">
              ✓ All tests passed!
            </div>
          )}
          
          {/* V2 Test Results with Per-Pair Details */}
          {testResults.testResults && testResults.testResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-gray-600">Test Case Details:</h4>
              {testResults.testResults.map((result, idx) => (
                <div key={idx} className={`p-2 rounded border text-xs ${
                  result.verdict === 'pass' 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium">{result.testCaseId}</span>
                    <span className={`px-2 py-0.5 rounded ${
                      result.verdict === 'pass' 
                        ? 'bg-green-200 text-green-800' 
                        : 'bg-red-200 text-red-800'
                    }`}>
                      {result.verdict}
                    </span>
                  </div>
                  
                  {result.testType && (
                    <div className="text-gray-600 mb-1">
                      Type: <span className="font-medium">{result.testType}</span>
                    </div>
                  )}
                  
                  {result.summary && (
                    <div className="text-gray-600 mb-1">{result.summary}</div>
                  )}
                  
                  {result.pairResults && result.pairResults.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="font-medium text-gray-700">Pair Results:</div>
                      {result.pairResults.map((pr, pIdx) => (
                        <div key={pIdx} className={`pl-3 py-1 border-l-2 ${
                          pr.success ? 'border-green-400' : 'border-red-400'
                        }`}>
                          <span className="font-medium">Pair {pIdx + 1}: </span>
                          <span className={pr.success ? 'text-green-700' : 'text-red-700'}>
                            {pr.success ? '✓ pass' : '✗ fail'}
                          </span>
                          <span className="text-gray-600 ml-2">({pr.phase})</span>
                          {pr.transition && (
                            <div className="text-gray-600 text-xs mt-0.5">
                              Transition: {pr.transition}
                            </div>
                          )}
                          {pr.reason && (
                            <div className="text-red-600 text-xs mt-0.5">
                              Reason: {pr.reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {result.reason && !result.pairResults && (
                    <div className="text-red-600 mt-1">{result.reason}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isExecuting && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm text-center">
          Executing tests...
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Test Cases</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {testSuite.testCases?.map((testCase, idx) => {
            const result = testResults?.testResults?.[idx];
            return (
              <div
                key={idx}
                className={`p-3 border rounded-lg text-sm ${
                  result?.passed === true
                    ? 'bg-green-50 border-green-200'
                    : result?.passed === false
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">Test {idx + 1}</span>
                  {result && (
                    <span className={`text-xs px-2 py-1 rounded ${
                      result.passed ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                    }`}>
                      {result.passed ? 'PASS' : 'FAIL'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600">
                  Intention: {testCase.intentionId}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Path: {testCase.expectedTrace?.length || 0} transitions
                  {testCase.expectedTrace && testCase.expectedTrace.length > 0 && (
                    <span className="ml-2 text-xs text-blue-600">
                      ({testCase.expectedTrace.map(t => t.transition).join(' → ')})
                    </span>
                  )}
                </div>
                {result?.errors && result.errors.length > 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    {result.errors.join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SatelPanel;
