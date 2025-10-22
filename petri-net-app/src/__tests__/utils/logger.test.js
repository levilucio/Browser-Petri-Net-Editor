import { logger, setDebug } from '../../utils/logger';

describe('logger', () => {
  const origEnv = process.env.NODE_ENV;
  let infoSpy, warnSpy, errorSpy, logSpy;
  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    process.env.NODE_ENV = origEnv;
    jest.restoreAllMocks();
    setDebug(false);
  });

  test('debug logs in development by default', () => {
    process.env.NODE_ENV = 'development';
    logger.debug('dev-debug');
    expect(logSpy).toHaveBeenCalled();
  });

  test('debug suppressed in production unless setDebug(true)', () => {
    process.env.NODE_ENV = 'production';
    logger.debug('prod-no');
    expect(logSpy).not.toHaveBeenCalled();
    setDebug(true);
    logger.debug('prod-yes');
    expect(logSpy).toHaveBeenCalled();
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


