let globalDebug = false;

export function setDebug(enabled) {
  globalDebug = !!enabled;
}

export const logger = {
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production' || globalDebug) {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  },
  info: (...args) => {
    // eslint-disable-next-line no-console
    console.info(...args);
  },
  warn: (...args) => {
    // eslint-disable-next-line no-console
    console.warn(...args);
  },
  error: (...args) => {
    // eslint-disable-next-line no-console
    console.error(...args);
  },
};


