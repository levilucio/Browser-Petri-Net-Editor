# Debug Instructions for List Token Issue

Add these console.log statements to `PropertiesPanel.jsx` at line 191 (right after `const parsed = ...`):

```javascript
const parts = splitTopLevel(input);
const parsed = parts.map(parsePart).filter(v => v !== null);

// ADD THESE DEBUG LINES:
console.log('Input:', input);
console.log('Parts after splitTopLevel:', parts);
console.log('Parsed tokens:', parsed);
console.log('Parsed tokens structure:', JSON.stringify(parsed, null, 2));
```

Then try entering `[1,2,'hello',T]` and check the browser console to see:
1. What `parts` contains
2. What `parsed` contains
3. How the structure looks

This will help us identify where the list is being unpacked.

