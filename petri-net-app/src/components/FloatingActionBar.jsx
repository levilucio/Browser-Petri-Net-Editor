import React, { useState, useEffect } from 'react';
import { usePetriNet } from '../contexts/PetriNetContext';
import { collectSelection } from '../features/selection/clipboard-utils';
import { deleteNodesAndIncidentArcs } from '../features/net/net-ops';
import { v4 as uuidv4 } from 'uuid';

const FloatingActionBar = () => {
  const {
    selectedElements,
    elements,
    setElements,
    setSelection,
    clearSelection,
    netMode,
    setClipboard,
    getClipboard,
    onClipboardMismatch,
    pasteMode,
    setPasteMode,
  } = usePetriNet();

  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(pointer: coarse)');
    const update = (event) => setIsTouchDevice(event.matches);
    update(media);
    if (media.addEventListener) {
      media.addEventListener('change', update);
    } else {
      media.addListener(update);
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', update);
      } else {
        media.removeListener(update);
      }
    };
  }, []);

  if (!isTouchDevice) return null;

  const getButtonStyle = (isActive = false, isDestructive = false) => ({
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: isActive 
      ? '#4338ca' 
      : isDestructive 
        ? '#dc2626' 
        : 'white',
    color: isActive || isDestructive ? 'white' : '#374151',
    border: isActive 
      ? '2px solid #312e81' 
      : isDestructive 
        ? '2px solid #991b1b' 
        : '1px solid #d1d5db',
    boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    marginBottom: '8px',
    cursor: 'pointer',
    position: 'relative',
  });

  const hasSelection = selectedElements.length > 0;
  const clipEntry = getClipboard();
  const hasClipboard = !!clipEntry && !!clipEntry.payload;

  const handleCopy = () => {
    if (!hasSelection) return;
    const selectionPayload = collectSelection(elements, selectedElements);
    const localMode = netMode || 'pt';
    if (typeof setClipboard === 'function') {
      setClipboard(selectionPayload);
    }
  };

  const handleCut = () => {
    if (!hasSelection) return;
    
    // Copy to clipboard first
    const selectionPayload = collectSelection(elements, selectedElements);
    const localMode = netMode || 'pt';
    if (typeof setClipboard === 'function') {
      setClipboard(selectionPayload);
    }
    
    // Then delete the selected elements
    setElements(prev => {
      const toDeleteNodes = [];
      const toDeleteArcs = new Set();
      selectedElements.forEach(se => {
        if (se.type === 'place' || se.type === 'transition') {
          toDeleteNodes.push(se.id);
        }
        if (se.type === 'arc') {
          toDeleteArcs.add(se.id);
        }
      });
      
      let next = prev;
      if (toDeleteNodes.length > 0) {
        next = deleteNodesAndIncidentArcs(next, toDeleteNodes);
      }
      if (toDeleteArcs.size > 0) {
        next = { ...next, arcs: next.arcs.filter(a => !toDeleteArcs.has(a.id)) };
      }
      return next;
    });
    
    clearSelection();
  };

  const handlePasteClick = () => {
    if (!hasClipboard) return;
    
    const localMode = netMode || 'pt';
    const clipboardMode = clipEntry.netMode || localMode;
    
    if (clipboardMode && localMode && clipboardMode !== localMode) {
      if (typeof onClipboardMismatch === 'function') {
        onClipboardMismatch(clipboardMode, localMode, clipEntry);
      } else {
        console.warn(`Blocked paste: shared clipboard contains ${clipboardMode} net, editor mode is ${localMode}.`);
      }
      return;
    }
    
    // Enter paste mode - user will tap canvas to paste
    setPasteMode(true);
  };

  // Calculate bottom position: FloatingEditorControls is at bottom-32 (128px)
  // We want to place action bar above it, accounting for button height (44px) + margin (8px)
  // So we need bottom-32 + 44 + 8 = bottom-52 (208px from bottom)
  return (
    <>
      {/* Paste mode indicator overlay */}
      {pasteMode && (
        <div className="fixed inset-0 z-40 bg-blue-500/10 flex items-center justify-center">
          <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <span className="text-sm font-medium">Tap on canvas to paste</span>
            <button
              onClick={() => setPasteMode(false)}
              className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors"
              title="Cancel paste"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      <div className="fixed bottom-52 left-6 z-50 flex flex-col items-center">
        {/* Paste button - shown when clipboard has content */}
        {hasClipboard && (
          <button
            style={getButtonStyle(pasteMode)}
            onClick={handlePasteClick}
            title={pasteMode ? "Tap canvas to paste" : "Paste"}
            data-testid="floating-action-paste"
            className="active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
          </button>
        )}

      {/* Copy/Cut buttons - shown when elements selected */}
      {hasSelection && (
        <>
          <button
            style={getButtonStyle(false)}
            onClick={handleCopy}
            title="Copy"
            data-testid="floating-action-copy"
            className="active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          <button
            style={getButtonStyle(false, true)}
            onClick={handleCut}
            title="Cut (replaces delete)"
            data-testid="floating-action-cut"
            className="active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="9" r="2" />
              <circle cx="9" cy="15" r="2" />
              <path d="M13 17h5a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-5" />
              <line x1="6" y1="12" x2="11" y2="12" />
            </svg>
          </button>
        </>
      )}
      </div>
    </>
  );
};

export default FloatingActionBar;

