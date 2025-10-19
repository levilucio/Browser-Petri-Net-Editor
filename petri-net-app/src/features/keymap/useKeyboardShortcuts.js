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

      // Copy
      if (!isEditable && ctrlOrCmd && (e.key === 'c' || e.key === 'C')) {
        if (selectedElements.length === 0) return;
        e.preventDefault();
        clipboardRef.current = collectSelection(elements, selectedElements);
        return;
      }

      // Paste
      if (!isEditable && ctrlOrCmd && (e.key === 'v' || e.key === 'V')) {
        const clip = clipboardRef.current;
        if (!clip) return;
        e.preventDefault();
        const { newPlaces, newTransitions, newArcs, newSelection } = remapIdsForPaste(clip, uuidv4, { x: 40, y: 40 });
        setElements(prev => ({
          ...prev,
          places: [...prev.places, ...newPlaces],
          transitions: [...prev.transitions, ...newTransitions],
          arcs: [...prev.arcs, ...newArcs],
        }));
        setTimeout(() => setSelection(newSelection), 0);
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
  }, [elements, selectedElements, selectedElement, setElements, clearSelection, setSelection, clipboardRef, ctx]);
}

export default useKeyboardShortcuts;


