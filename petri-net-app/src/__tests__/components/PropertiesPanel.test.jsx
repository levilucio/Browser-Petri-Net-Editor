import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PropertiesPanel from '../../components/PropertiesPanel';

describe('PropertiesPanel Component', () => {
  // Mock setElements function
  const mockSetElements = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders empty panel when no element is selected', () => {
    render(<PropertiesPanel selectedElement={null} setElements={mockSetElements} />);
    
    expect(screen.getByText('Properties')).toBeInTheDocument();
    expect(screen.getByText('Select an element to edit its properties')).toBeInTheDocument();
  });

  test('renders place properties when a place is selected', () => {
    const mockPlace = {
      id: 'place-1',
      name: 'P1',
      tokens: 5,
      x: 100,
      y: 100
    };

    render(<PropertiesPanel selectedElement={mockPlace} setElements={mockSetElements} />);
    
    expect(screen.getByText('Properties')).toBeInTheDocument();
    
    // Find the name input by looking for the div containing the label 'Name'
    const nameDiv = screen.getByText('Name').closest('div');
    const nameInput = within(nameDiv).getByRole('textbox');
    expect(nameInput).toHaveValue('P1');
    
    // Find the tokens input by looking for the div containing the label 'Tokens (0-20)'
    const tokensDiv = screen.getByText('Tokens (0-20)').closest('div');
    const tokensInput = within(tokensDiv).getByRole('spinbutton');
    expect(tokensInput).toHaveValue(5);
  });

  test('renders transition properties when a transition is selected', () => {
    const mockTransition = {
      id: 'transition-1',
      name: 'T1',
      x: 100,
      y: 100
    };

    render(<PropertiesPanel selectedElement={mockTransition} setElements={mockSetElements} />);
    
    expect(screen.getByText('Properties')).toBeInTheDocument();
    
    // Find the name input by looking for the div containing the label 'Name'
    const nameDiv = screen.getByText('Name').closest('div');
    const nameInput = within(nameDiv).getByRole('textbox');
    expect(nameInput).toHaveValue('T1');
    
    // Transition should not have token input
    expect(screen.queryByText('Tokens (0-20)')).not.toBeInTheDocument();
  });

  test('renders arc properties when an arc is selected', () => {
    const mockArc = {
      id: 'arc-1',
      name: 'A1',
      weight: 3,
      sourceId: 'place-1',
      targetId: 'transition-1',
      sourceType: 'place',
      targetType: 'transition'
    };

    render(<PropertiesPanel selectedElement={mockArc} setElements={mockSetElements} />);
    
    expect(screen.getByText('Properties')).toBeInTheDocument();
    
    // Find the name input by looking for the div containing the label 'Name'
    const nameDiv = screen.getByText('Name').closest('div');
    const nameInput = within(nameDiv).getByRole('textbox');
    expect(nameInput).toHaveValue('A1');
    
    // Find the weight input by looking for the div containing the label 'Weight (1-20)'
    const weightDiv = screen.getByText('Weight (1-20)').closest('div');
    const weightInput = within(weightDiv).getByRole('spinbutton');
    expect(weightInput).toHaveValue(3);
  });

  test('updates place name when input changes', () => {
    const mockPlace = {
      id: 'place-1',
      name: 'P1',
      tokens: 5,
      x: 100,
      y: 100
    };

    render(<PropertiesPanel selectedElement={mockPlace} setElements={mockSetElements} />);
    
    const nameDiv = screen.getByText('Name').closest('div');
    const nameInput = within(nameDiv).getByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'NewPlaceName' } });
    
    expect(mockSetElements).toHaveBeenCalled();
    // Check that the first call to mockSetElements is a function
    expect(typeof mockSetElements.mock.calls[0][0]).toBe('function');
  });

  test('updates place tokens when input changes', () => {
    const mockPlace = {
      id: 'place-1',
      name: 'P1',
      tokens: 5,
      x: 100,
      y: 100
    };

    render(<PropertiesPanel selectedElement={mockPlace} setElements={mockSetElements} />);
    
    const tokensDiv = screen.getByText('Tokens (0-20)').closest('div');
    const tokensInput = within(tokensDiv).getByRole('spinbutton');
    fireEvent.change(tokensInput, { target: { value: '10' } });
    
    expect(mockSetElements).toHaveBeenCalled();
  });

  test('updates transition name when input changes', () => {
    const mockTransition = {
      id: 'transition-1',
      name: 'T1',
      x: 100,
      y: 100
    };

    render(<PropertiesPanel selectedElement={mockTransition} setElements={mockSetElements} />);
    
    const nameDiv = screen.getByText('Name').closest('div');
    const nameInput = within(nameDiv).getByRole('textbox');
    fireEvent.change(nameInput, { target: { value: 'NewTransitionName' } });
    
    expect(mockSetElements).toHaveBeenCalled();
  });

  test('updates arc weight when input changes', () => {
    const mockArc = {
      id: 'arc-1',
      name: 'A1',
      weight: 3,
      sourceId: 'place-1',
      targetId: 'transition-1',
      sourceType: 'place',
      targetType: 'transition'
    };

    render(<PropertiesPanel selectedElement={mockArc} setElements={mockSetElements} />);
    
    const weightDiv = screen.getByText('Weight (1-20)').closest('div');
    const weightInput = within(weightDiv).getByRole('spinbutton');
    fireEvent.change(weightInput, { target: { value: '5' } });
    
    expect(mockSetElements).toHaveBeenCalled();
  });

  test('validates token count within range (0-20)', () => {
    const mockPlace = {
      id: 'place-1',
      name: 'P1',
      tokens: 5,
      x: 100,
      y: 100
    };

    render(<PropertiesPanel selectedElement={mockPlace} setElements={mockSetElements} />);
    
    const tokensDiv = screen.getByText('Tokens (0-20)').closest('div');
    const tokensInput = within(tokensDiv).getByRole('spinbutton');
    
    // Test with valid value
    fireEvent.change(tokensInput, { target: { value: '15' } });
    expect(mockSetElements).toHaveBeenCalled();
    mockSetElements.mockClear();
    
    // Test with value above max
    fireEvent.change(tokensInput, { target: { value: '25' } });
    expect(mockSetElements).toHaveBeenCalled();
    // Check that the value is capped at 20
    const updateFunction = mockSetElements.mock.calls[0][0];
    const result = updateFunction({
      places: [{ id: 'place-1', tokens: 5 }],
      transitions: [],
      arcs: []
    });
    expect(result.places[0].tokens).toBe(20);
  });

  test('validates arc weight within range (1-20)', () => {
    const mockArc = {
      id: 'arc-1',
      name: 'A1',
      weight: 3,
      sourceId: 'place-1',
      targetId: 'transition-1',
      sourceType: 'place',
      targetType: 'transition'
    };

    render(<PropertiesPanel selectedElement={mockArc} setElements={mockSetElements} />);
    
    const weightDiv = screen.getByText('Weight (1-20)').closest('div');
    const weightInput = within(weightDiv).getByRole('spinbutton');
    
    // Test with valid value
    fireEvent.change(weightInput, { target: { value: '15' } });
    expect(mockSetElements).toHaveBeenCalled();
    mockSetElements.mockClear();
    
    // Test with value below min
    fireEvent.change(weightInput, { target: { value: '0' } });
    expect(mockSetElements).toHaveBeenCalled();
    // Check that the value is capped at minimum 1
    const updateFunction = mockSetElements.mock.calls[0][0];
    const result = updateFunction({
      places: [],
      transitions: [],
      arcs: [{ id: 'arc-1', weight: 3 }]
    });
    expect(result.arcs[0].weight).toBe(1);
  });
});
