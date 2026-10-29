// Known presentation fields only. Unknown extension fields remain significant.
const presentation = new Set(['x', 'y', 'width', 'height', 'rotation', 'selected', 'label', 'labelPosition', 'labelOffset', 'labelOffsetX', 'labelOffsetY', 'color', 'fill', 'stroke', 'points', 'controlPoints', 'bendPoints']);
const strip = item => Object.fromEntries(Object.entries(item).filter(([key]) => !presentation.has(key)));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export function semanticNet(net, {
  definitionOnly = false,
  intentions = false
} = {}) {
  const places = (net.places || []).map(p => {
    const result = strip(p);
    if (definitionOnly) {
      delete result.tokens;
      delete result.valueTokens;
    }
    return result;
  });
  return {
    mode: net.mode,
    gates: net.gates,
    places,
    transitions: (net.transitions || []).map(strip),
    arcs: (net.arcs || []).map(strip),
    adtDefinitions: net.adtDefinitions,
    customAdts: net.customAdts,
    ...(intentions ? {
      testIntentions: net.testIntentions
    } : {})
  };
}
export const semanticFingerprint = (net, options) => JSON.stringify(canonical(semanticNet(net, options)));
