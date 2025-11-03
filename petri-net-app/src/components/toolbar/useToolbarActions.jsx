import { exportToPNML, importFromPNML } from '../../utils/python/index';
import { simulatorCore } from '../../features/simulation';
import { detectNetModeFromContent } from '../../utils/netMode';

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
          places: Array.isArray(petriNetJson.places) ? petriNetJson.places : [],
          transitions: Array.isArray(petriNetJson.transitions) ? petriNetJson.transitions : [],
          arcs: Array.isArray(petriNetJson.arcs) ? petriNetJson.arcs : []
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
        setSuccess?.(`Petri net loaded successfully with ${safeJson.places.length} places, ${safeJson.transitions.length} transitions, and ${safeJson.arcs.length} arcs.`);
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
  };

  return { handleSave, handleSaveAs, handleLoad, handleClear, handleOpenAdtManager };
}



