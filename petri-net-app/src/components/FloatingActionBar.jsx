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

  // Position near top-left, below the toolbar (which has minHeight: 70px)
  // Using top-24 (96px) to give space below toolbar
  return (
    <>
      {/* Paste mode indicator - top notification bar style */}
      {pasteMode && (
        <div 
          className="fixed left-0 right-0 z-50 flex justify-center"
          style={{ top: '72px' }}
        >
          <div 
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.25rem',
              backgroundColor: '#dbeafe', // blue-100
              color: '#1d4ed8', // blue-700
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.875rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              maxWidth: '90%',
            }}
          >
            <span>Tap on canvas to paste</span>
            <button 
              onClick={() => setPasteMode(false)} 
              style={{ marginLeft: '1rem', fontWeight: '600' }}
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      {/* Action buttons - positioned near top-left, below toolbar */}
      <div className="fixed top-24 left-4 z-50 flex flex-col items-center">
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
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <line x1="20" y1="4" x2="8.12" y2="15.88" />
                <line x1="14.47" y1="14.48" x2="20" y2="20" />
                <line x1="8.12" y1="8.12" x2="12" y2="12" />
              </svg>
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default FloatingActionBar;

