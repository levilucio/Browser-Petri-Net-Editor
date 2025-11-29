import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { collectSelection, remapIdsForPaste } from '../selection/clipboard-utils';
import { deleteNodesAndIncidentArcs } from '../net/net-ops';

export function useKeyboardShortcuts(ctx) {
  const {
    elements, setElements,
    selectedElement, selectedElements,
    clearSelection, setSelection,
    clipboardRef,
    netMode,
    setClipboard,
    getClipboard,
    onClipboardMismatch,
    // Optional actions wired when available
    handleUndo,
    handleRedo,
    setMode,
    arcStart,
    setArcStart,
    setTempArcEnd,
    setSelectedElement,
    pasteMode,
    setPasteMode,
  } = ctx;

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Shift' && ctx.isShiftPressedRef) ctx.isShiftPressedRef.current = true;

      const target = e.target;
      const tag = target?.tagName;
      const isEditable = (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable);

      if (!isEditable && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedElements.length === 0 && !selectedElement) return;
        e.preventDefault();
        setElements(prev => {
          const toDeleteNodes = [];
          const toDeleteArcs = new Set();
          if (selectedElements.length > 0) {
            selectedElements.forEach(se => {
              if (se.type === 'place' || se.type === 'transition') toDeleteNodes.push(se.id);
              if (se.type === 'arc') toDeleteArcs.add(se.id);
            });
          } else if (selectedElement) {
            if (selectedElement.type === 'place' || selectedElement.type === 'transition') toDeleteNodes.push(selectedElement.id);
            if (selectedElement.type === 'arc') toDeleteArcs.add(selectedElement.id);
          }
          let next = prev;
          if (toDeleteNodes.length > 0) next = deleteNodesAndIncidentArcs(next, toDeleteNodes);
          if (toDeleteArcs.size > 0) next = { ...next, arcs: next.arcs.filter(a => !toDeleteArcs.has(a.id)) };
          return next;
        });
        clearSelection();
        return;
      }

      // Select All
      if (!isEditable && ctrlOrCmd && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const allElements = [
          ...elements.places.map(p => ({ id: p.id, type: 'place' })),
          ...elements.transitions.map(t => ({ id: t.id, type: 'transition' })),
          ...elements.arcs.map(a => ({ id: a.id, type: 'arc' }))
        ];
        setSelection(allElements);
        return;
      }

      // Undo / Redo
      if (!isEditable && ctrlOrCmd && (e.key === 'z' || e.key === 'Z')) {
        if (typeof handleUndo === 'function') {
          e.preventDefault();
          handleUndo();
          return;
        }
      }
      if (!isEditable && ctrlOrCmd && (e.key === 'y' || e.key === 'Y')) {
        if (typeof handleRedo === 'function') {
          e.preventDefault();
          handleRedo();
          return;
        }
      }

      // Mode switching (no modifiers)
      if (!isEditable && !ctrlOrCmd) {
        if ((e.key === 'p' || e.key === 'P') && typeof setMode === 'function') { e.preventDefault(); setMode('place'); return; }
        if ((e.key === 't' || e.key === 'T') && typeof setMode === 'function') { e.preventDefault(); setMode('transition'); return; }
        if ((e.key === 'a' || e.key === 'A') && typeof setMode === 'function') { e.preventDefault(); setMode('arc'); return; }
        if ((e.key === 's' || e.key === 'S') && typeof setMode === 'function') { e.preventDefault(); setMode('select'); return; }
        if (e.key === 'Escape') {
          e.preventDefault();
          // Cancel paste mode first if active
          if (pasteMode && typeof setPasteMode === 'function') {
            setPasteMode(false);
            return;
          }
          if (typeof setMode === 'function') setMode('select');
          if (typeof setArcStart === 'function' && arcStart) setArcStart(null);
          if (typeof setTempArcEnd === 'function') setTempArcEnd(null);
          if (typeof setSelectedElement === 'function') setSelectedElement(null);
          return;
        }
      }

      // Copy
      if (!isEditable && ctrlOrCmd && (e.key === 'c' || e.key === 'C')) {
        if (selectedElements.length === 0) return;
        e.preventDefault();
        const selectionPayload = collectSelection(elements, selectedElements);
        const localMode = netMode || 'pt';
        if (typeof setClipboard === 'function') {
          setClipboard(selectionPayload);
        } else if (clipboardRef) {
          clipboardRef.current = {
            payload: selectionPayload,
            netMode: localMode,
            source: 'local',
            timestamp: Date.now(),
          };
        }
        return;
      }

      // Paste
      if (!isEditable && ctrlOrCmd && (e.key === 'v' || e.key === 'V')) {
        const localMode = netMode || 'pt';
        const clipEntry = typeof getClipboard === 'function' ? getClipboard() : clipboardRef?.current;
        if (!clipEntry) return;
        const payload = clipEntry.payload || clipEntry;
        if (!payload) return;
        const clipboardMode = clipEntry.netMode || localMode;
        if (clipboardMode && localMode && clipboardMode !== localMode) {
          if (typeof onClipboardMismatch === 'function') {
            onClipboardMismatch(clipboardMode, localMode, clipEntry);
          } else {
            console.warn(`Blocked paste: shared clipboard contains ${clipboardMode} net, editor mode is ${localMode}.`);
          }
          return;
        }
        e.preventDefault();
        const { newPlaces, newTransitions, newArcs, newSelection } = remapIdsForPaste(payload, uuidv4, { x: 40, y: 40 });
        setElements(prev => ({
          ...prev,
          places: [...prev.places, ...newPlaces],
          transitions: [...prev.transitions, ...newTransitions],
          arcs: [...prev.arcs, ...newArcs],
        }));
        // Immediately transfer selection to the freshly pasted elements
        setSelection(newSelection);
        return;
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Shift' && ctx.isShiftPressedRef) ctx.isShiftPressedRef.current = false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [elements, selectedElements, selectedElement, setElements, clearSelection, setSelection, clipboardRef, ctx, handleUndo, handleRedo, setMode, arcStart, setArcStart, setTempArcEnd, setSelectedElement]);
}

export default useKeyboardShortcuts;


