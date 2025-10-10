// Unified simulator options and helpers

const DEFAULTS = {
  maxTokensPerPlace: 20,
  selectionPolicy: 'single', // 'single' | 'maximal'
  rngSeed: undefined,
  debug: false,
};

export function normalizeOptions(opts) {
  const o = { ...DEFAULTS, ...(opts || {}) };
  if (typeof o.maxTokensPerPlace !== 'number' || o.maxTokensPerPlace < 0) o.maxTokensPerPlace = DEFAULTS.maxTokensPerPlace;
  if (!['single', 'maximal'].includes(o.selectionPolicy)) o.selectionPolicy = DEFAULTS.selectionPolicy;
  return o;
}

export function getDefaultOptions() {
  return { ...DEFAULTS };
}


