const LEVEL_ORDER = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

const DEFAULT_ENV_LEVEL = (() => {
  const globalLevel = typeof globalThis !== 'undefined' ? globalThis.__PETRI_NET_LOG_LEVEL__ : undefined;
  const nodeLevel = typeof process !== 'undefined'
    ? (process.env?.VITE_LOG_LEVEL || process.env?.LOG_LEVEL)
    : undefined;
  const fallback = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') ? 'warn' : 'debug';
  return (globalLevel || nodeLevel || fallback || 'warn').toLowerCase();
})();

function resolveLevel(level) {
  if (!level) return 'warn';
  const key = String(level).toLowerCase();
  return LEVEL_ORDER[key] !== undefined ? key : 'warn';
}

let currentLevel = resolveLevel(DEFAULT_ENV_LEVEL);

export const DEFAULT_LOG_LEVEL = currentLevel;

export function setLogLevel(level) {
  currentLevel = resolveLevel(level);
}

export function getLogLevel() {
  return currentLevel;
}

export function shouldLog(level) {
  const resolved = resolveLevel(level);
  return LEVEL_ORDER[resolved] <= LEVEL_ORDER[currentLevel];
}

export const loggingLevels = Object.freeze({ ...LEVEL_ORDER });

