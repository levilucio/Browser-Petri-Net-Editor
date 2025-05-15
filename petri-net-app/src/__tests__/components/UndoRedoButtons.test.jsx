import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar from '../../components/Toolbar';

describe('Undo/Redo Buttons', () => {
  // Mock functions for undo and redo
  const mockHandleUndo = jest.fn();
  const mockHandleRedo = jest.fn();
  
  beforeEach(() => {
    // Clear mocks before each test
    mockHandleUndo.mockClear();
    mockHandleRedo.mockClear();
  });
  
  test('should render undo and redo buttons', () => {
    render(
      <Toolbar 
        mode="select" 
        setMode={() => {}} 
        canUndo={true} 
        canRedo={true} 
        onUndo={mockHandleUndo} 
        onRedo={mockHandleRedo}
        gridSnappingEnabled={true}
        toggleGridSnapping={() => {}}
      />
    );
    
    // Check if undo and redo buttons are rendered
    const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
    const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
    
    expect(undoButton).toBeInTheDocument();
    expect(redoButton).toBeInTheDocument();
  });
  
  test('should call onUndo when undo button is clicked', () => {
    render(
      <Toolbar 
        mode="select" 
        setMode={() => {}} 
        canUndo={true} 
        canRedo={true} 
        onUndo={mockHandleUndo} 
        onRedo={mockHandleRedo}
        gridSnappingEnabled={true}
        toggleGridSnapping={() => {}}
      />
    );
    
    // Click the undo button
    const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
    fireEvent.click(undoButton);
    
    // Check if the onUndo callback was called
    expect(mockHandleUndo).toHaveBeenCalled();
  });
  
  test('should call onRedo when redo button is clicked', () => {
    render(
      <Toolbar 
        mode="select" 
        setMode={() => {}} 
        canUndo={true} 
        canRedo={true} 
        onUndo={mockHandleUndo} 
        onRedo={mockHandleRedo}
        gridSnappingEnabled={true}
        toggleGridSnapping={() => {}}
      />
    );
    
    // Click the redo button
    const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
    fireEvent.click(redoButton);
    
    // Check if the onRedo callback was called
    expect(mockHandleRedo).toHaveBeenCalled();
  });
  
  test('should disable undo button when canUndo is false', () => {
    render(
      <Toolbar 
        mode="select" 
        setMode={() => {}} 
        canUndo={false} 
        canRedo={true} 
        onUndo={mockHandleUndo} 
        onRedo={mockHandleRedo}
        gridSnappingEnabled={true}
        toggleGridSnapping={() => {}}
      />
    );
    
    // Check if the undo button is disabled
    const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
    expect(undoButton).toBeDisabled();
  });
  
  test('should disable redo button when canRedo is false', () => {
    render(
      <Toolbar 
        mode="select" 
        setMode={() => {}} 
        canUndo={true} 
        canRedo={false} 
        onUndo={mockHandleUndo} 
        onRedo={mockHandleRedo}
        gridSnappingEnabled={true}
        toggleGridSnapping={() => {}}
      />
    );
    
    // Check if the redo button is disabled
    const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
    expect(redoButton).toBeDisabled();
  });
});
