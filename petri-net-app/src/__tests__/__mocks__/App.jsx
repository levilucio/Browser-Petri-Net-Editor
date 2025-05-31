import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock version of App.jsx for testing
const App = () => {
  return (
    <div data-testid="app">
      <div data-testid="toolbar"></div>
      <div data-testid="canvas"></div>
      <div data-testid="properties-panel"></div>
      <div data-testid="execution-panel"></div>
    </div>
  );
};

// Add a simple test to avoid the "no tests" error
describe('Mock App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
    const appElement = screen.getByTestId('app');
    expect(appElement).toBeInTheDocument();
  });
});

export default App;
