// Z3 loader script - loads Z3 initialization function and makes it globally available
(async function() {
  try {
    console.log('Loading Z3 initialization function...');
    
    // Load the Z3 built script
    const response = await fetch('/z3-built.js');
    if (!response.ok) {
      throw new Error(`Failed to fetch z3-built.js: ${response.status}`);
    }
    
    const z3Script = await response.text();
    
    // Execute the script in a way that defines initZ3 globally
    const scriptElement = document.createElement('script');
    scriptElement.textContent = z3Script;
    document.head.appendChild(scriptElement);
    
    // Verify initZ3 is available
    if (typeof globalThis.initZ3 === 'function') {
      console.log('Z3 initialization function loaded successfully');
      
      // Dispatch an event to notify the app that Z3 is ready
      window.dispatchEvent(new CustomEvent('z3-ready'));
    } else {
      throw new Error('initZ3 function not found after loading z3-built.js');
    }
  } catch (error) {
    console.error('Failed to load Z3 initialization function:', error);
    
    // Dispatch an error event
    window.dispatchEvent(new CustomEvent('z3-error', { detail: error.message }));
  }
})();

