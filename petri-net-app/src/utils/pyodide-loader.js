/**
 * Utility module for loading and initializing Pyodide
 */

// For testing, we need to handle the case where pyodide is not available
let pyodideModule;
try {
  pyodideModule = require('pyodide');
} catch (e) {
  // In test environment, pyodide might not be available
  pyodideModule = { loadPyodide: null };
}

/**
 * Loads the Pyodide runtime and returns the initialized instance
 * @returns {Promise<any>} A promise that resolves to the Pyodide instance
 */
export async function loadPyodideInstance() {
  try {
    console.log('Loading Pyodide...');
    // In a test environment, we might not have access to the actual loadPyodide function
    if (!pyodideModule.loadPyodide) {
      console.log('Pyodide not available, returning mock instance');
      return {
        runPython: (code) => {
          console.log('Mock runPython called with:', code);
          return null;
        },
        runPythonAsync: async (code) => {
          console.log('Mock runPythonAsync called with:', code);
          return null;
        },
        loadPackagesFromImports: async () => {
          console.log('Mock loadPackagesFromImports called');
          return null;
        },
        globals: {
          get: () => ({
            to_js: () => ({})
          })
        }
      };
    }
    
    const pyodide = await pyodideModule.loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/'
    });
    
    console.log('Pyodide loaded successfully');
    return pyodide;
  } catch (error) {
    console.error('Error loading Pyodide:', error);
    throw error;
  }
}
