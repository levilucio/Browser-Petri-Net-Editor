import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

// Set up Jest timers
jest.useFakeTimers();

// Mock Konva components
jest.mock('react-konva', () => {
  const mockStage = {
    getPointerPosition: jest.fn().mockReturnValue({ x: 100, y: 100 }),
  };
  
  return {
    Stage: ({ children, onClick, ...props }) => (
      <div 
        data-testid="stage" 
        {...props} 
        onClick={(e) => {
          // Mock the getStage method
          e.target.getStage = () => mockStage;
          if (onClick) onClick(e);
        }}
      >
        {children}
      </div>
    ),
    Layer: ({ children, ...props }) => <div data-testid="layer" {...props}>{children}</div>,
    Group: ({ children, onClick, ...props }) => (
      <div 
        data-testid="group" 
        {...props} 
        onClick={(e) => {
          // Prevent event propagation to simulate Konva behavior
          e.stopPropagation();
          if (onClick) onClick(e);
        }}
      >
        {children}
      </div>
    ),
    Circle: (props) => <div data-testid="circle" {...props} />,
    Rect: (props) => <div data-testid="rect" {...props} />,
    Line: (props) => <div data-testid="line" {...props} />,
    Arrow: (props) => <div data-testid="arrow" {...props} />,
    Text: ({ text, ...props }) => <div data-testid="text" {...props}>{text}</div>,
  };
});

// Mock child components
jest.mock('../components/Place', () => ({ place, isSelected, onClick }) => (
  <div data-testid="place-component" data-id={place.id} data-selected={isSelected} onClick={onClick}>
    {place.name}
  </div>
));

jest.mock('../components/Transition', () => ({ transition, isSelected, onClick }) => (
  <div data-testid="transition-component" data-id={transition.id} data-selected={isSelected} onClick={onClick}>
    {transition.name}
  </div>
));

jest.mock('../components/Arc', () => ({ arc }) => (
  <div data-testid="arc-component" data-id={arc.id}>
    {arc.sourceId} → {arc.targetId}
  </div>
));

jest.mock('../components/Toolbar', () => ({ mode, setMode }) => (
  <div data-testid="toolbar">
    <button data-testid="select-mode" onClick={() => setMode('select')}>Select</button>
    <button data-testid="place-mode" onClick={() => setMode('place')}>Place</button>
    <button data-testid="transition-mode" onClick={() => setMode('transition')}>Transition</button>
    <button data-testid="arc-mode" onClick={() => setMode('arc')}>Arc</button>
  </div>
));

jest.mock('../components/PropertiesPanel', () => ({ selectedElement, setElements }) => (
  <div data-testid="properties-panel">
    {selectedElement ? `Editing: ${selectedElement.id}` : 'No selection'}
  </div>
));

jest.mock('../components/ExecutionPanel', () => ({ elements }) => (
  <div data-testid="execution-panel">
    Places: {elements.places.length}, Transitions: {elements.transitions.length}
  </div>
));

jest.mock('../components/Grid', () => () => <div data-testid="grid"></div>);



describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders main components', () => {
    render(<App />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('stage')).toBeInTheDocument();
    expect(screen.getByTestId('properties-panel')).toBeInTheDocument();
    expect(screen.getByTestId('execution-panel')).toBeInTheDocument();
  });

  test('starts with select mode', () => {
    render(<App />);
    // We can't directly test the state, but we can test its effects
    expect(screen.getByTestId('properties-panel')).toHaveTextContent('No selection');
  });

  test('changes mode when toolbar buttons are clicked', () => {
    // Mock the getPointerPosition method to return a fixed position
    const mockGetPointerPosition = jest.fn().mockReturnValue({ x: 100, y: 100 });
    
    // Mock the getStage method to return a stage with the mocked getPointerPosition
    const mockGetStage = jest.fn().mockReturnValue({
      getPointerPosition: mockGetPointerPosition
    });
    
    // Render the App component
    render(<App />);
    
    // Click place mode button
    fireEvent.click(screen.getByTestId('place-mode'));
    
    // Click on the stage with mocked event target
    const stage = screen.getByTestId('stage');
    fireEvent.click(stage, {
      target: {
        getStage: mockGetStage,
        name: jest.fn().mockReturnValue('background')
      }
    });
    
    // Re-render to ensure state updates are reflected
    jest.runAllTimers();
    
    // Check if a place was added (we can't directly check the state, but we can check if components are rendered)
    const places = screen.queryAllByTestId('place-component');
    expect(places.length).toBeGreaterThan(0);
  });

  test('selects elements when clicked in select mode', () => {
    // Mock the getPointerPosition method to return a fixed position
    const mockGetPointerPosition = jest.fn().mockReturnValue({ x: 100, y: 100 });
    
    // Mock the getStage method to return a stage with the mocked getPointerPosition
    const mockGetStage = jest.fn().mockReturnValue({
      getPointerPosition: mockGetPointerPosition
    });
    
    // Render the App component
    render(<App />);
    
    // Switch to select mode
    const selectModeButton = screen.getByTestId('select-mode');
    fireEvent.click(selectModeButton);
    
    // Add a place by clicking on the stage
    // First switch to place mode
    const placeModeButton = screen.getByTestId('place-mode');
    fireEvent.click(placeModeButton);
    
    // Click on the stage to add a place with mocked event target
    const stage = screen.getByTestId('stage');
    fireEvent.click(stage, {
      target: {
        getStage: mockGetStage,
        name: jest.fn().mockReturnValue('background')
      }
    });
    
    // Switch back to select mode
    fireEvent.click(selectModeButton);
    
    // Re-render to ensure state updates are reflected
    jest.runAllTimers();
    
    // Check if execution panel shows the place count
    expect(screen.getByTestId('execution-panel')).toHaveTextContent('Places: 1');
  });
});
