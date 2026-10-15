/** A test setup is applied once, before any firing. Never repairs a running net. */
export function withInitialMarking(net, marking = {}) {
  const result = JSON.parse(JSON.stringify(net));
  if (!marking || typeof marking !== 'object' || Array.isArray(marking)) throw new Error('Initial marking must map place IDs to token arrays');
  for (const [id, tokens] of Object.entries(marking)) {
    const place = result.places.find(p => p.id === id);
    if (!place) throw new Error(`Unknown initial-marking place: ${id}`);
    if (!Array.isArray(tokens)) throw new Error(`Initial marking must be a token array: ${id}`);
    place.valueTokens = JSON.parse(JSON.stringify(tokens));
    place.tokens = tokens.length;
  }
  return result;
}
export function initialMarkingOf(net) {
  return Object.fromEntries(net.places.map(p => [p.id, JSON.parse(JSON.stringify(p.valueTokens || []))]));
}
