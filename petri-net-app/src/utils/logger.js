import { DEFAULT_LOG_LEVEL, getLogLevel, setLogLevel as setConfigLevel, shouldLog } from '../config/logging';

export function setLogLevel(level) {
  setConfigLevel(level);
}

export function setDebug(enabled) {
  setConfigLevel(enabled ? 'debug' : DEFAULT_LOG_LEVEL);
}

export { getLogLevel };

export const logger = {
  debug: (...args) => {
    if (shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.debug(...args);
    }
  },
  info: (...args) => {
    if (shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info(...args);
    }
  },
  warn: (...args) => {
    if (shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(...args);
    }
  },
  error: (...args) => {
    if (shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(...args);
    }
  },
};

