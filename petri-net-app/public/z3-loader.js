// Z3 loader script - loads Z3 initialization function and makes it globally available
(async function() {
  try {
    console.log('Loading Z3 initialization function...');
    
    // Load the Z3 built script
    const scriptElement = document.createElement('script');
    scriptElement.src = 'z3-built.js';
    scriptElement.async = true;

    await new Promise((resolve, reject) => {
      scriptElement.addEventListener('load', () => {
        if (typeof globalThis.initZ3 === 'function') {
          console.log('Z3 initialization function loaded successfully');
          window.dispatchEvent(new CustomEvent('z3-ready'));
          resolve();
        } else {
          reject(new Error('initZ3 function not found after loading z3-built.js'));
        }
      });
      scriptElement.addEventListener('error', (err) => {
        reject(new Error(`Failed to load z3-built.js: ${err?.message || err}`));
      });
      document.head.appendChild(scriptElement);
    });
  } catch (error) {
    console.error('Failed to load Z3 initialization function:', error);
    
    // Dispatch an error event
    window.dispatchEvent(new CustomEvent('z3-error', { detail: error.message }));
  }
})();

