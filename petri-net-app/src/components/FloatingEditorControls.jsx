import React, { useState, useEffect } from 'react';
import { usePetriNet } from '../contexts/PetriNetContext';

const FloatingEditorControls = () => {
  const { mode, setMode } = usePetriNet();
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

  const getButtonStyle = (isActive) => ({
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: isActive ? '#4338ca' : 'white',
    color: isActive ? 'white' : '#374151',
    border: isActive ? '2px solid #312e81' : '1px solid #d1d5db',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    marginBottom: '12px',
    cursor: 'pointer',
    position: 'relative',
  });

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-center">
      {/* Arc Button */}
      <button
        style={getButtonStyle(mode === 'arc')}
        onClick={() => setMode('arc')}
        title="Arc Tool"
        className="active:scale-95"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21l18-18M3 21l7-1M3 21l1-7" />
        </svg>
      </button>

      {/* Transition Button */}
      <button
        style={getButtonStyle(mode === 'transition')}
        onClick={() => setMode('transition')}
        title="Transition Tool"
        className="active:scale-95"
      >
        <div style={{ width: '14px', height: '32px', backgroundColor: 'currentColor' }} />
      </button>

      {/* Place Button */}
      <button
        style={getButtonStyle(mode === 'place')}
        onClick={() => setMode('place')}
        title="Place Tool"
        className="active:scale-95"
      >
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid currentColor', backgroundColor: 'transparent' }} />
      </button>

      {/* Select Button (to exit creation modes) */}
      <button
        style={getButtonStyle(mode === 'select')}
        onClick={() => setMode('select')}
        title="Select Tool"
        className="active:scale-95"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        </svg>
      </button>
    </div>
  );
};

export default FloatingEditorControls;

