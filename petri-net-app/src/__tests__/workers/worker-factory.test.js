// @ts-check
import { createSimulationWorker } from '../../workers/worker-factory';

describe('createSimulationWorker', () => {
  const originalWindow = global.window;
  const originalWorker = global.Worker;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalWorkerId = process.env.JEST_WORKER_ID;

  afterEach(() => {
    global.window = originalWindow;
    global.Worker = originalWorker;
    process.env.NODE_ENV = originalNodeEnv;
    if (originalWorkerId === undefined) {
      delete process.env.JEST_WORKER_ID;
    } else {
      process.env.JEST_WORKER_ID = originalWorkerId;
    }
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

  test('creates worker via module URL when environment allows', () => {
    global.window = originalWindow || {};
    process.env.NODE_ENV = 'development';
    delete process.env.JEST_WORKER_ID;

    const workerInstance = { kind: 'vite-worker' };
    global.Worker = jest.fn(() => workerInstance);

    const result = createSimulationWorker();

    expect(global.Worker).toHaveBeenCalledTimes(1);
    const [urlArg, optionsArg] = global.Worker.mock.calls[0];
    expect(urlArg).toBeInstanceOf(URL);
    expect(urlArg.toString()).toContain('/src/workers/simulation.worker.js');
    expect(optionsArg).toEqual({ type: 'module' });
    expect(result).toBe(workerInstance);
  });

  test('returns null when worker construction throws', () => {
    global.window = originalWindow || {};
    process.env.NODE_ENV = 'development';
    delete process.env.JEST_WORKER_ID;

    const error = new Error('constructor failure');
    global.Worker = jest.fn(() => {
      throw error;
    });

    const result = createSimulationWorker();
    expect(result).toBeNull();
  });
});


