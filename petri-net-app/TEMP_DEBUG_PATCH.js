// Add these console.log statements to PropertiesPanel.jsx 
// in the handleValueTokensBlur function, right after line 191:

const parts = splitTopLevel(input);
const parsed = parts.map(parsePart).filter(v => v !== null);

// ADD THESE:
console.log('=== DEBUG handleValueTokensBlur ===');
console.log('1. Input string:', input);
console.log('2. After splitTopLevel:', parts);
console.log('3. After parsing each part:', parsed);
console.log('4. Parsed length:', parsed.length);
console.log('5. First element type:', Array.isArray(parsed[0]) ? 'Array' : typeof parsed[0]);
console.log('6. First element value:', parsed[0]);
console.log('===================================');

const elementId = selectedElement.id || (selectedElement.element && selectedElement.element.id);

