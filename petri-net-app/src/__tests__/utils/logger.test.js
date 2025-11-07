import { logger, setDebug, setLogLevel, getLogLevel } from '../../utils/logger';

describe('logger', () => {
  const origEnv = process.env.NODE_ENV;
  let infoSpy;
  let warnSpy;
  let errorSpy;
  let debugSpy;
  let originalLevel;
  beforeEach(() => {
    originalLevel = getLogLevel();
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    setLogLevel('debug');
  });
  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    jest.restoreAllMocks();
    setLogLevel(originalLevel);
  });

  test('debug logs in development by default', () => {
    process.env.NODE_ENV = 'development';
    logger.debug('dev-debug');
    expect(debugSpy).toHaveBeenCalled();
  });

  test('debug suppressed in production unless setDebug(true)', () => {
    process.env.NODE_ENV = 'production';
    setLogLevel('warn');
    logger.debug('prod-no');
    expect(debugSpy).not.toHaveBeenCalled();
    setDebug(true);
    logger.debug('prod-yes');
    expect(debugSpy).toHaveBeenCalled();
  });

  test('info/warn/error always forward', () => {
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(infoSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });
});


