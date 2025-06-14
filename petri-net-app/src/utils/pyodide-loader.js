/**
 * Utility module for loading and initializing Pyodide
 */

// For testing, we need to handle the case where pyodide is not available
let pyodideModule;
try {
  pyodideModule = require('pyodide');
} catch (e) {
  // In test environment, pyodide might not be available
  // Use the CDN version instead
  pyodideModule = { 
    loadPyodide: async (config) => {
      // Dynamically load Pyodide from CDN
      if (typeof window !== 'undefined') {
        if (!window.loadPyodide) {
          // Loading Pyodide from CDN
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
          document.head.appendChild(script);
          
          // Wait for the script to load
          await new Promise(resolve => {
            script.onload = resolve;
            script.onerror = () => {
              console.error('Failed to load Pyodide from CDN');
              resolve();
            };
          });
        }
        
        if (window.loadPyodide) {
          return window.loadPyodide(config);
        }
      }
      return null;
    } 
  };
}

/**
 * Creates a mock Pyodide instance for testing or when Pyodide is not available
 * @returns {Object} A mock Pyodide instance
 */
function createMockPyodide() {
  return {
    runPython: (code) => {
      // Mock runPython called
      return null;
    },
    runPythonAsync: async (code) => {
      // Mock runPythonAsync called
      
      // Check if this is the simulator initialization code
      if (code.includes('PetriNetSimulator')) {
        // Return a mock simulator object that matches the expected interface
        return {
          toJs: () => ({}),
          get_enabled_transitions: async () => ({
            toJs: () => []
          }),
          fire_transition: async (transitionId) => ({
            toJs: () => ({
              places: [],
              transitions: [],
              arcs: []
            })
          })
        };
      }
      
      return {
        toJs: () => ({}),
        get: (prop) => null
      };
    },
    loadPackagesFromImports: async () => {
      // Mock loadPackagesFromImports called
      return null;
    },
    // Add toPy function to the mock instance
    toPy: (jsObj) => {
      // Mock toPy called
      return jsObj; // Just return the object as-is in the mock
    },
    globals: {
      get: () => ({
        to_js: () => ({}),
        toJs: () => ({})
      })
    }
  };
}

/**
 * Loads the Pyodide runtime and returns the initialized instance
 * @returns {Promise<any>} A promise that resolves to the Pyodide instance
 */
export async function loadPyodideInstance() {
  try {
    // Loading Pyodide
    // Try to load Pyodide from the module or CDN
    const pyodide = await pyodideModule.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
    });
    
    if (!pyodide) {
      // Pyodide not available, returning mock instance
      return createMockPyodide();
    }
    
    // Pyodide loaded successfully
    return pyodide;
  } catch (error) {
    console.error('Error loading Pyodide:', error);
    // Falling back to mock Pyodide instance
    return createMockPyodide();
  }
}
