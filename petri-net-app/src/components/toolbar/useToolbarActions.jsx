import { exportToPNML, importFromPNML } from '../../utils/python/index';
import { simulatorCore } from '../../features/simulation';
import { detectNetModeFromContent } from '../../utils/netMode';
import { computeAutoLayout } from '../../features/layout/petri-net-layout';

export default function useToolbarActions(params) {
  const {
    elements,
    setElements,
    updateHistory,
    simulationSettings,
    setSimulationSettings,
    resetEditor,
    forceSimulatorReset,
    setIsLoading,
    setError,
    setSuccess,
    setIsAdtOpen,
    saveFileHandle,
    setSaveFileHandle,
    setIsMobileMenuOpen,
  } = params || {};

  const handleOpenAdtManager = () => {
    if (!setIsAdtOpen) return;
    setIsAdtOpen(true);
  };

  const writeToHandle = async (handle, pnmlString) => {
    const writable = await handle.createWritable();
    await writable.write(new Blob([pnmlString], { type: 'application/xml' }));
    await writable.close();
  };

  const handleSave = async () => {
    try {
      setIsLoading?.(true);
      setError?.(null);
      setSuccess?.(null);

      const elementsWithMode = {
        ...(elements || {}),
        netMode: simulationSettings?.netMode || 'pt'
      };

      const pnmlString = await exportToPNML(elementsWithMode);
      const defaultName = 'petri-net.pnml';
      const hasFS = typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
      if (hasFS) {
        try {
          if (saveFileHandle) {
            await writeToHandle(saveFileHandle, pnmlString);
          } else {
            const handle = await window.showSaveFilePicker({
              suggestedName: defaultName,
              types: [{ description: 'PNML Files', accept: { 'application/xml': ['.pnml', '.xml'], 'text/xml': ['.pnml', '.xml'] } }],
              excludeAcceptAllOption: false,
            });
            await writeToHandle(handle, pnmlString);
            setSaveFileHandle?.(handle);
          }
        } catch (err) {
          if (err && (err.name === 'AbortError' || err.name === 'SecurityError')) {
            setSuccess?.('Save cancelled.');
          } else {
            const blob = new Blob([pnmlString], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = defaultName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        }
      } else {
        const blob = new Blob([pnmlString], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setSuccess?.('Petri net saved.');
      setIsMobileMenuOpen?.(false);
    } catch (error) {
      console.error('Error saving Petri net:', error);
      setError?.(`Error saving Petri net: ${error.message}`);
    } finally {
      setIsLoading?.(false);
    }
  };

  const handleSaveAs = async () => {
    try {
      setIsLoading?.(true);
      setError?.(null);
      setSuccess?.(null);

      const elementsWithMode = {
        ...(elements || {}),
        netMode: simulationSettings?.netMode || 'pt'
      };
      const pnmlString = await exportToPNML(elementsWithMode);
      const defaultName = 'petri-net.pnml';

      const hasFS = typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
      if (hasFS) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: defaultName,
            types: [{ description: 'PNML Files', accept: { 'application/xml': ['.pnml', '.xml'], 'text/xml': ['.pnml', '.xml'] } }],
            excludeAcceptAllOption: false,
          });
          await writeToHandle(handle, pnmlString);
          setSaveFileHandle?.(handle);
        } catch (err) {
          if (err && (err.name === 'AbortError' || err.name === 'SecurityError')) {
            setSuccess?.('Save cancelled.');
          } else {
            const blob = new Blob([pnmlString], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = defaultName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        }
      } else {
        const blob = new Blob([pnmlString], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      setSuccess?.('Petri net saved.');
      setIsMobileMenuOpen?.(false);
    } catch (error) {
      console.error('Error saving Petri net:', error);
      setError?.(`Error saving Petri net: ${error.message}`);
    } finally {
      setIsLoading?.(false);
    }
  };

  const handleLoad = () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pnml,.xml';
    try { fileInput.style.display = 'none'; document.body.appendChild(fileInput); } catch (_) {}

    fileInput.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      try {
        setIsLoading?.(true);
        setError?.(null);
        setSuccess?.(null);

        const fileContent = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = reject;
          reader.readAsText(file);
        });

        if (!fileContent || String(fileContent).trim() === '') {
          throw new Error('The selected file is empty');
        }

        if (!String(fileContent).includes('<pnml') && !String(fileContent).includes('<PNML')) {
          throw new Error('The file does not appear to be a valid PNML file');
        }

        const petriNetJsonPromise = importFromPNML(fileContent);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Operation timed out. The file may be too large or invalid.')), 10000);
        });
        const petriNetJson = await Promise.race([petriNetJsonPromise, timeoutPromise]);

        if (!petriNetJson || typeof petriNetJson !== 'object') {
          throw new Error('Invalid data structure in the imported file');
        }

        const safeJson = {
          ...(petriNetJson.netMode ? { netMode: petriNetJson.netMode, mode: petriNetJson.netMode } : {}),
          ...(petriNetJson.testIntentions ? { testIntentions: petriNetJson.testIntentions } : {}),
          ...(petriNetJson.satelExample ? { satelExample: petriNetJson.satelExample } : {}),
          places: Array.isArray(petriNetJson.places) ? petriNetJson.places : [],
          transitions: Array.isArray(petriNetJson.transitions) ? petriNetJson.transitions : [],
          arcs: Array.isArray(petriNetJson.arcs) ? petriNetJson.arcs : [],
          // Include properties if present (for validation dialog)
          ...(Array.isArray(petriNetJson.properties) && petriNetJson.properties.length > 0
            ? { properties: petriNetJson.properties }
            : {}),
        };

        const validArcs = (safeJson.arcs || []).filter(arc => {
          if (arc.source === 'undefined' || arc.target === 'undefined' || !arc.source || !arc.target) return false;
          const sourceExists = safeJson.places.some(p => p.id === arc.source) || safeJson.transitions.some(t => t.id === arc.source);
          const targetExists = safeJson.places.some(p => p.id === arc.target) || safeJson.transitions.some(t => t.id === arc.target);
          return sourceExists && targetExists;
        });
        safeJson.arcs = validArcs.map(arc => {
          if (!arc.type || (arc.type !== 'place-to-transition' && arc.type !== 'transition-to-place')) {
            const sourceIsPlace = safeJson.places.some(p => p.id === arc.source);
            const targetIsPlace = safeJson.places.some(p => p.id === arc.target);
            if (sourceIsPlace && !targetIsPlace) return { ...arc, type: 'place-to-transition' };
            if (!sourceIsPlace && targetIsPlace) return { ...arc, type: 'transition-to-place' };
            return { ...arc, type: 'place-to-transition' };
          }
          return arc;
        });

        // Force simulator reset when loading a new net
        if (forceSimulatorReset) forceSimulatorReset();
        setElements?.(safeJson);

        const storedMode = safeJson.netMode;
        if (storedMode) {
          setSimulationSettings?.(prev => ({ ...(prev || {}), netMode: storedMode }));
        } else {
          try {
            const importedMode = detectNetModeFromContent(safeJson);
            setSimulationSettings?.(prev => ({ ...(prev || {}), netMode: importedMode }));
          } catch (_) {}
        }

        if (updateHistory) updateHistory(safeJson);
        const propCount = safeJson.properties?.length || 0;
        const propMsg = propCount > 0 ? ` and ${propCount} properties` : '';
        setSuccess?.(`Petri net loaded successfully with ${safeJson.places.length} places, ${safeJson.transitions.length} transitions, ${safeJson.arcs.length} arcs${propMsg}.`);
        setIsMobileMenuOpen?.(false);
      } catch (error) {
        console.error('Error loading Petri net:', error);
        setError?.(`Error loading Petri net: ${error.message}`);
      } finally {
        setIsLoading?.(false);
        try { if (fileInput && fileInput.parentNode) { fileInput.parentNode.removeChild(fileInput); } } catch (_) {}
      }
    };

    fileInput.click();
  };

  const handleClear = () => {
    try {
      simulatorCore.deactivateSimulation?.();
      simulatorCore.reset?.();
    } catch (e) { /* noop */ }

    if (resetEditor) {
      resetEditor();
    } else {
      const emptyState = { places: [], transitions: [], arcs: [] };
      setElements?.(emptyState);
      setSimulationSettings?.(prev => ({ ...(prev || {}), netMode: 'pt' }));
      if (updateHistory) updateHistory(emptyState);
    }

    setSuccess?.('Canvas cleared successfully.');
    setIsMobileMenuOpen?.(false);
  };

  const handleLoadExample = async (filename) => {
    try {
      setIsLoading?.(true);
      setError?.(null);
      setSuccess?.(null);

      if (filename.startsWith('hml-selection-')) {
        const { createHmlSelectionExample } = await import('../../satel/examples/hml-selection/editor.js');
        const net = createHmlSelectionExample(filename);
        forceSimulatorReset?.(); setElements(net);
        setSimulationSettings(prev => ({ ...prev, netMode: 'algebraic' }));
        updateHistory?.(net); setSuccess?.(`Loaded ${net.satelExample.name}. Open SATEL → Generated tests.`);
        setIsMobileMenuOpen?.(false); return;
      }
      if (filename.startsWith('nondeterminism-')) {
        const { createNondeterminismExample } = await import('../../satel/examples/nondeterminism/editor.js');
        const net = createNondeterminismExample(filename);
        forceSimulatorReset?.(); setElements(net);
        setSimulationSettings(prev => ({ ...prev, netMode: 'algebraic' }));
        updateHistory?.(net); setSuccess?.(`Loaded ${net.satelExample.name}. Open SATEL → Generated tests.`);
        setIsMobileMenuOpen?.(false); return;
      }
      if (filename.startsWith('refusal-')) {
        const { createRefusalExample } = await import('../../satel/examples/refusal/editor.js');
        const net = createRefusalExample(filename);
        forceSimulatorReset?.(); setElements(net);
        setSimulationSettings(prev => ({ ...prev, netMode: 'algebraic' }));
        updateHistory?.(net); setSuccess?.(`Loaded ${net.satelExample.name}. Open SATEL → Generated tests.`);
        setIsMobileMenuOpen?.(false); return;
      }
      if (filename.startsWith('exercise-')) {
        const { createExerciseExample } = await import('../../satel/examples/exercises/editor.js');
        const net = createExerciseExample(filename);
        forceSimulatorReset?.(); setElements(net);
        setSimulationSettings(prev => ({ ...prev, netMode: 'algebraic' }));
        updateHistory?.(net); setSuccess?.(`Loaded ${net.satelExample.name}. Open SATEL → Generated tests.`);
        setIsMobileMenuOpen?.(false); return;
      }
      if (filename.startsWith('fulfilment-')) {
        const { createFulfilmentExample } = await import('../../satel/examples/fulfilment/editor.js');
        const net = createFulfilmentExample(filename);
        forceSimulatorReset?.(); setElements(net);
        setSimulationSettings(prev => ({ ...prev, netMode: 'algebraic' }));
        updateHistory?.(net); setSuccess?.(`Loaded ${net.satelExample.name}. Open SATEL → Generated tests.`);
        setIsMobileMenuOpen?.(false); return;
      }
      if (['executable-sequence', 'executable-sequence-mutant'].includes(filename)) {
        const { createExecutableSequenceExample } = await import('../../satel/examples/executable-sequence/editor.js');
        const net = createExecutableSequenceExample(filename.endsWith('-mutant'));
        forceSimulatorReset?.(); setElements(net);
        setSimulationSettings(prev => ({ ...prev, netMode: 'algebraic' }));
        updateHistory?.(net); setSuccess?.(`Loaded ${net.satelExample.name}. Open SATEL → Generated tests.`);
        setIsMobileMenuOpen?.(false); return;
      }
      if (['typed-store', 'typed-store-mutant'].includes(filename)) {
        const { createTypedStoreExample } = await import('../../satel/examples/typed-store/editor.js');
        const net = createTypedStoreExample(filename.endsWith('-mutant'));
        forceSimulatorReset?.(); setElements(net);
        setSimulationSettings(prev => ({ ...prev, netMode: 'algebraic' }));
        updateHistory?.(net); setSuccess?.(`Loaded ${net.satelExample.name}. Open SATEL → Intentions to review or generate tests.`);
        setIsMobileMenuOpen?.(false); return;
      }
      if (['builtin-types', 'compound-guard', 'compound-guard-mutant'].includes(filename)) {
        const { createBuiltinTypesExample, createCompoundGuardExample } = await import('../../satel/examples/compound-guard/editor.js');
        const net = filename === 'builtin-types' ? createBuiltinTypesExample() : createCompoundGuardExample(filename.endsWith('-mutant'));
        forceSimulatorReset?.(); setElements(net);
        setSimulationSettings(prev => ({ ...prev, netMode: 'algebraic' }));
        updateHistory?.(net); setSuccess?.(`Loaded ${net.satelExample.name}. Open SATEL → Intentions to review or generate tests.`);
        setIsMobileMenuOpen?.(false); return;
      }
      if (filename === 'symbolic-list') {
        const { createSymbolicListExample } = await import('../../satel/examples/symbolic-list/editor.js');
        const net = createSymbolicListExample();
        forceSimulatorReset?.(); setElements(net);
        setSimulationSettings(prev => ({ ...prev, netMode: 'algebraic' }));
        updateHistory?.(net); setSuccess?.('Loaded List membership. Open SATEL → Generated tests → Advanced details to derive classes.');
        setIsMobileMenuOpen?.(false); return;
      }
      if (filename.startsWith('oracle-account-')) {
        const { createOracleAccountExample } = await import('../../satel/examples/oracle-account/editor.js');
        const net = createOracleAccountExample(filename);
        forceSimulatorReset?.();
        setElements(net);
        setSimulationSettings(prev => ({ ...prev, netMode: 'algebraic' }));
        updateHistory?.(net);
        setSuccess?.(`Loaded ${net.satelExample.name}. Open SATEL → Intentions to review or generate tests.`);
        setIsMobileMenuOpen?.(false);
        return;
      }

      // Special case: Manufacturing Workflow loads from JS object
      if (filename === 'manufacturing-workflow') {
        const { manufacturingNet } = await import('../../satel/examples/manufacturing/net.js');
        const { manufacturingIntentionsV2 } = await import('../../satel/examples/manufacturing/intentions-v2.js');
        
        // Convert to the format expected by the app
        const safeJson = {
          places: manufacturingNet.places || [],
          transitions: manufacturingNet.transitions || [],
          arcs: manufacturingNet.arcs || [],
          mode: manufacturingNet.mode || 'algebraic',
          adtDefinitions: manufacturingNet.adtDefinitions || ''
        };
        
        safeJson.testIntentions = manufacturingIntentionsV2;
        forceSimulatorReset?.();
        updateHistory?.(safeJson);
        setElements(safeJson);
        setSimulationSettings({
          ...simulationSettings,
          netMode: 'algebraic',
        });
        setSuccess?.(`Loaded Manufacturing Workflow with ${manufacturingIntentionsV2.length} test intentions`);
        setIsMobileMenuOpen?.(false);
        setIsLoading?.(false);
        return;
      }

      // Standard PNML loading
      // Fetch the example file from the public/examples folder
      // Use URL constructor to handle relative paths correctly on all devices
      const exampleUrl = new URL(`./examples/${filename}`, window.location.href).href;
      const response = await fetch(exampleUrl);
      if (!response.ok) {
        throw new Error(`Failed to load example file: ${response.statusText}`);
      }

      const fileContent = await response.text();

      if (!fileContent || String(fileContent).trim() === '') {
        throw new Error('The example file is empty');
      }

      if (!String(fileContent).includes('<pnml') && !String(fileContent).includes('<PNML')) {
        throw new Error('The file does not appear to be a valid PNML file');
      }

      const petriNetJsonPromise = importFromPNML(fileContent);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timed out. The file may be too large or invalid.')), 10000);
      });
      const petriNetJson = await Promise.race([petriNetJsonPromise, timeoutPromise]);

      if (!petriNetJson || typeof petriNetJson !== 'object') {
        throw new Error('Invalid data structure in the imported file');
      }

      const safeJson = {
        places: Array.isArray(petriNetJson.places) ? petriNetJson.places : [],
        transitions: Array.isArray(petriNetJson.transitions) ? petriNetJson.transitions : [],
        arcs: Array.isArray(petriNetJson.arcs) ? petriNetJson.arcs : [],
        // Include properties if present (for validation dialog)
        ...(Array.isArray(petriNetJson.properties) && petriNetJson.properties.length > 0
          ? { properties: petriNetJson.properties }
          : {}),
      };

      const validArcs = (safeJson.arcs || []).filter(arc => {
        if (arc.source === 'undefined' || arc.target === 'undefined' || !arc.source || !arc.target) return false;
        const sourceExists = safeJson.places.some(p => p.id === arc.source) || safeJson.transitions.some(t => t.id === arc.source);
        const targetExists = safeJson.places.some(p => p.id === arc.target) || safeJson.transitions.some(t => t.id === arc.target);
        return sourceExists && targetExists;
      });
      safeJson.arcs = validArcs.map(arc => {
        if (!arc.type || (arc.type !== 'place-to-transition' && arc.type !== 'transition-to-place')) {
          const sourceIsPlace = safeJson.places.some(p => p.id === arc.source);
          const targetIsPlace = safeJson.places.some(p => p.id === arc.target);
          if (sourceIsPlace && !targetIsPlace) return { ...arc, type: 'place-to-transition' };
          if (!sourceIsPlace && targetIsPlace) return { ...arc, type: 'transition-to-place' };
          return { ...arc, type: 'place-to-transition' };
        }
        return arc;
      });

      // Force simulator reset when loading a new net
      if (forceSimulatorReset) forceSimulatorReset();
      setElements?.(safeJson);

      const storedMode = safeJson.netMode;
      if (storedMode) {
        setSimulationSettings?.(prev => ({ ...(prev || {}), netMode: storedMode }));
      } else {
        try {
          const importedMode = detectNetModeFromContent(safeJson);
          setSimulationSettings?.(prev => ({ ...(prev || {}), netMode: importedMode }));
        } catch (_) {}
      }

      if (updateHistory) updateHistory(safeJson);
      const propCount = safeJson.properties?.length || 0;
      const propMsg = propCount > 0 ? ` and ${propCount} properties` : '';
      setSuccess?.(`Example "${filename}" loaded successfully with ${safeJson.places.length} places, ${safeJson.transitions.length} transitions, ${safeJson.arcs.length} arcs${propMsg}.`);
      setIsMobileMenuOpen?.(false);
    } catch (error) {
      console.error('Error loading example:', error);
      setError?.(`Error loading example: ${error.message}`);
    } finally {
      setIsLoading?.(false);
    }
  };

  const handleAutoLayout = () => {
    try {
      setIsLoading?.(true);
      setError?.(null);
      setSuccess?.(null);

      const places = elements?.places || [];
      const transitions = elements?.transitions || [];
      const arcs = elements?.arcs || [];

      if (places.length === 0 && transitions.length === 0) {
        setError?.('No elements to layout. Add some places and transitions first.');
        setIsLoading?.(false);
        return;
      }

      // Compute new layout
      const { places: newPlaces, transitions: newTransitions } = computeAutoLayout(
        places,
        transitions,
        arcs
      );

      // Update elements with new positions
      const updatedElements = {
        ...elements,
        places: newPlaces,
        transitions: newTransitions,
        arcs: arcs, // Arcs remain the same
      };

      setElements?.(updatedElements);
      if (updateHistory) updateHistory(updatedElements);

      setSuccess?.(`Auto-layout applied to ${newPlaces.length} places and ${newTransitions.length} transitions.`);
      setIsMobileMenuOpen?.(false);
    } catch (error) {
      console.error('Error applying auto-layout:', error);
      setError?.(`Error applying auto-layout: ${error.message}`);
    } finally {
      setIsLoading?.(false);
    }
  };

  return { 
    handleSave, 
    handleSaveAs, 
    handleLoad, 
    handleClear, 
    handleOpenAdtManager, 
    handleLoadExample,
    handleAutoLayout 
  };
}



