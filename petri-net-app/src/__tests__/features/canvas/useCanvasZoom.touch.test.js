import { renderHook, act } from '@testing-library/react';
import { useCanvasZoom } from '../../../features/canvas/useCanvasZoom';

// Mock requestAnimationFrame
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

describe('useCanvasZoom - Touch Device Functionality', () => {
  let container;
  let setZoomLevel;
  let setCanvasScroll;
  let setContainerRef;
  let canvasScrollState;

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    setZoomLevel = jest.fn((fn) => {
      if (typeof fn === 'function') {
        return fn(1);
      }
      return fn;
    });
    canvasScrollState = { x: 0, y: 0 };
    setCanvasScroll = jest.fn((updater) => {
      if (typeof updater === 'function') {
        canvasScrollState = updater(canvasScrollState);
      } else if (updater && typeof updater === 'object') {
        canvasScrollState = updater;
      }
      return canvasScrollState;
    });
    setContainerRef = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  const createTouchEvent = (type, touches, changedTouches = touches) => {
    const event = new Event(type, { bubbles: true, cancelable: true });
    event.touches = touches;
    event.changedTouches = changedTouches;
    event.preventDefault = jest.fn();
    event.stopPropagation = jest.fn();
    return event;
  };

  const createTouch = (id, clientX, clientY) => ({
    identifier: id,
    clientX,
    clientY,
    target: container,
  });

const buildHookProps = (override = {}) => ({
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 3,
  zoomLevel: 1,
  setZoomLevel,
  virtualCanvasDimensions: { width: 2000, height: 2000 },
  canvasScroll: { x: 0, y: 0 },
  setCanvasScroll,
  setContainerRef,
  isDragging: false,
  isSelectionActiveRef: { current: false },
  ...override,
});

const renderZoomHook = (override = {}) => {
  const props = buildHookProps(override);
  const hook = renderHook((hookProps) => useCanvasZoom(hookProps), { initialProps: props });
  return { ...hook, props };
};

const attachContainer = (result, rerender, props) => {
  act(() => {
    // Call the callback ref directly
    result.current.localCanvasContainerDivRef(container);
  });
  // Rerender to process the state update triggered by the callback ref
  act(() => rerender(props));
  act(() => {
    jest.advanceTimersByTime(0);
  });
};

  test('handles two-finger pinch-to-zoom gesture', () => {
    const { result, rerender, props } = renderZoomHook();
    attachContainer(result, rerender, props);

    // Start two-finger gesture
    const touch1 = createTouch(1, 100, 100);
    const touch2 = createTouch(2, 200, 100);
    const startEvent = createTouchEvent('touchstart', [touch1, touch2]);
    
    act(() => {
      container.dispatchEvent(startEvent);
    });

    // Move fingers apart (pinch out - zoom in) - distance increases significantly
    const touch1Move = createTouch(1, 50, 100);  // Move further apart
    const touch2Move = createTouch(2, 250, 100);
    const moveEvent = createTouchEvent('touchmove', [touch1Move, touch2Move]);
    
    act(() => {
      container.dispatchEvent(moveEvent);
      jest.advanceTimersByTime(100);
    });

    // Verify zoom was called (distance increased significantly, so zoom should increase)
    // Note: The zoom threshold is 5%, so we need a significant distance change
    expect(setZoomLevel).toHaveBeenCalled();
    expect(moveEvent.preventDefault).toHaveBeenCalled();

    // Move fingers apart (pinch out - zoom in)
    const touch1Move2 = createTouch(1, 90, 100);
    const touch2Move2 = createTouch(2, 210, 100);
    const moveEvent2 = createTouchEvent('touchmove', [touch1Move2, touch2Move2]);
    
    act(() => {
      container.dispatchEvent(moveEvent2);
      jest.advanceTimersByTime(100);
    });

    expect(setZoomLevel).toHaveBeenCalledTimes(2);
    expect(moveEvent2.preventDefault).toHaveBeenCalled();
  });

  test('handles two-finger pan gesture', () => {
    const { result, rerender, props } = renderZoomHook();
    attachContainer(result, rerender, props);

    // Start two-finger gesture with constant distance (pan, not zoom)
    const touch1 = createTouch(1, 100, 100);
    const touch2 = createTouch(2, 200, 100);
    const startEvent = createTouchEvent('touchstart', [touch1, touch2]);
    
    act(() => {
      container.dispatchEvent(startEvent);
    });

    // Move both fingers together maintaining distance (pan)
    // Distance stays ~100px (within 5% threshold), so it's a pan gesture
    const touch1Move = createTouch(1, 150, 150);
    const touch2Move = createTouch(2, 250, 150); // Still 100px apart
    const moveEvent = createTouchEvent('touchmove', [touch1Move, touch2Move]);
    
    act(() => {
      container.dispatchEvent(moveEvent);
      jest.advanceTimersByTime(100);
    });

    // Second move to apply pan delta after activation
    const touch1Move2 = createTouch(1, 120, 120);
    const touch2Move2 = createTouch(2, 220, 120);
    const moveEvent2 = createTouchEvent('touchmove', [touch1Move2, touch2Move2]);
    
    act(() => {
      container.dispatchEvent(moveEvent2);
      jest.advanceTimersByTime(50);
    });

    // Pan should trigger scroll update after threshold (5px movement)
    // Note: Pan activates after 5px movement, so we need to move enough
    expect(canvasScrollState).not.toEqual({ x: 0, y: 0 });
    expect(moveEvent.preventDefault).toHaveBeenCalled();
  });

  test('handles single-finger pan when activated programmatically', () => {
    const { result, rerender, props } = renderZoomHook();
    attachContainer(result, rerender, props);

    // Start single-finger touch
    const touch1 = createTouch(1, 100, 100);
    const startEvent = createTouchEvent('touchstart', [touch1]);
    
    act(() => {
      container.dispatchEvent(startEvent);
    });

    // Pan is now activated by CanvasManager calling activateSingleFingerPan
    // Simulate that call
    act(() => {
      result.current.activateSingleFingerPan();
    });

    // Pan should now be active
    expect(result.current.isSingleFingerPanningActive).toBe(true);

    // Continue moving - should pan
    const touch1Move = createTouch(1, 140, 140);
    const moveEvent = createTouchEvent('touchmove', [touch1Move]);
    
    act(() => {
      container.dispatchEvent(moveEvent);
    });

    expect(setCanvasScroll).toHaveBeenCalled();
    expect(moveEvent.preventDefault).toHaveBeenCalled();
  });

  test('single-finger pan is not active until explicitly activated', () => {
    const { result, rerender, props } = renderZoomHook();
    attachContainer(result, rerender, props);

    // Start single-finger touch
    const touch1 = createTouch(1, 100, 100);
    const startEvent = createTouchEvent('touchstart', [touch1]);
    
    act(() => {
      container.dispatchEvent(startEvent);
    });

    // Move finger - but pan not activated yet
    const touch1Move = createTouch(1, 130, 130);
    const moveEvent = createTouchEvent('touchmove', [touch1Move]);
    
    act(() => {
      container.dispatchEvent(moveEvent);
      jest.advanceTimersByTime(250);
    });

    // Pan should NOT be active since activateSingleFingerPan wasn't called
    expect(result.current.isSingleFingerPanningActive).toBe(false);
  });

  test('cancels single-finger pan when dragging starts', () => {
    const initialProps = buildHookProps({ isDragging: false });
    const { result, rerender } = renderHook(
      (hookProps) => useCanvasZoom(hookProps),
      { initialProps }
    );
    attachContainer(result, rerender, initialProps);

    // Start single-finger touch
    const touch1 = createTouch(1, 100, 100);
    const startEvent = createTouchEvent('touchstart', [touch1]);
    
    act(() => {
      container.dispatchEvent(startEvent);
    });

    // Activate pan
    act(() => {
      result.current.activateSingleFingerPan();
    });

    expect(result.current.isSingleFingerPanningActive).toBe(true);

    // Now set isDragging to true
    const draggingProps = buildHookProps({ isDragging: true });
    rerender(draggingProps);

    // Try to move again - should clear pan since dragging
    const touch1Move = createTouch(1, 140, 140);
    const moveEvent = createTouchEvent('touchmove', [touch1Move]);
    
    act(() => {
      container.dispatchEvent(moveEvent);
    });

    // Pan should be cancelled because isDragging is true
    expect(result.current.isSingleFingerPanningActive).toBe(false);
  });

  test('clears touch state on touchend', () => {
    const { result, rerender, props } = renderZoomHook();
    attachContainer(result, rerender, props);

    // Start two-finger gesture
    const touch1 = createTouch(1, 100, 100);
    const touch2 = createTouch(2, 200, 100);
    const startEvent = createTouchEvent('touchstart', [touch1, touch2]);
    
    act(() => {
      container.dispatchEvent(startEvent);
    });

    // End touch
    const endEvent = createTouchEvent('touchend', [], [touch1, touch2]);
    
    act(() => {
      container.dispatchEvent(endEvent);
    });

    // State should be cleared
    expect(result.current.isSingleFingerPanningActive).toBe(false);
  });
});

