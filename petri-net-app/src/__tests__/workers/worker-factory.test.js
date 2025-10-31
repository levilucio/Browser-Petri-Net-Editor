// @ts-check
import { createSimulationWorker } from '../../workers/worker-factory';

describe('createSimulationWorker', () => {
  const originalWindow = global.window;
  const originalWorker = global.Worker;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalWorkerId = process.env.JEST_WORKER_ID;
  const originalFunction = global.Function;

  afterEach(() => {
    global.window = originalWindow;
    global.Worker = originalWorker;
    process.env.NODE_ENV = originalNodeEnv;
    if (originalWorkerId === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = originalWorkerId;
    }
    global.Function = originalFunction;
  });

  test('returns null when window is undefined', () => {
    // @ts-ignore
    delete global.window;
    expect(createSimulationWorker()).toBeNull();
  });

  test('returns null when Worker API missing', () => {
    global.window = originalWindow;
    // @ts-ignore
    delete global.Worker;
    expect(createSimulationWorker()).toBeNull();
  });

  test('returns null during test environments', () => {
    global.window = originalWindow;
    global.Worker = originalWorker || jest.fn();
    process.env.NODE_ENV = 'test';
    expect(createSimulationWorker()).toBeNull();
  });

  test('uses primary worker factory when environment allows', () => {
    global.window = originalWindow;
    process.env.NODE_ENV = 'development';
    delete process.env.JEST_WORKER_ID;

    const workerInstance = { kind: 'primary' };
    global.Worker = jest.fn(() => workerInstance);
    global.Function = jest.fn(() => jest.fn(() => workerInstance));

    const result = createSimulationWorker();
    expect(global.Function).toHaveBeenCalled();
    expect(result).toBe(workerInstance);
  });

  test('falls back to absolute worker path when primary creation fails', () => {
    global.window = originalWindow;
    process.env.NODE_ENV = 'development';
    delete process.env.JEST_WORKER_ID;

    const fallbackInstance = { kind: 'fallback' };
    global.Worker = jest.fn(() => fallbackInstance);
    global.Function = jest.fn(() => {
      throw new Error('factory failure');
    });

    const result = createSimulationWorker();
    expect(global.Worker).toHaveBeenCalledWith('/src/workers/simulation.worker.js', { type: 'module' });
    expect(result).toBe(fallbackInstance);
  });
});


