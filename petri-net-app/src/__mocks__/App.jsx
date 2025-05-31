import React from 'react';

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

export default App;
