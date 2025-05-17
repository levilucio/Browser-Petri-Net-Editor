import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './utils/debug-parser';  // Import the debug parser tools
import './utils/arc-debug';  // Import arc debugging tools

// Make debug tools available in browser console for debugging
console.log('Arc debugging tools loaded - use analyzePNML() and traceArcFlow() in console')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
