// Mock Vite's import.meta.env for Jest tests
global.import = {
  meta: {
    env: {
      MODE: 'test',
      VITE_APP_TITLE: 'Petri Net Editor',
      // Add any other environment variables used in the app
    }
  }
};

jest.mock('../utils/z3-remote', () => ({
  setZ3WorkerConfig: jest.fn(),
  getConfiguredPoolSize: jest.fn(() => 0),
  isWorkerPoolEnabled: jest.fn(() => false),
  parseBooleanExpr: jest.fn(async () => { throw new Error('Z3 worker disabled in tests'); }),
  evaluateBooleanPredicate: jest.fn(async () => { throw new Error('Z3 worker disabled in tests'); }),
  evaluateArithmeticWithBindings: jest.fn(async () => { throw new Error('Z3 worker disabled in tests'); }),
  evaluateAction: jest.fn(async () => { throw new Error('Z3 worker disabled in tests'); }),
  solveEquation: jest.fn(async () => { throw new Error('Z3 worker disabled in tests'); }),
  solveInequality: jest.fn(async () => { throw new Error('Z3 worker disabled in tests'); }),
}));

// Set up any other global mocks needed for tests

// Add a simple test to avoid the "no tests" error
describe('Test Environment Setup', () => {
  test('import.meta.env is properly mocked', () => {
    expect(global.import.meta.env.MODE).toBe('test');
    expect(global.import.meta.env.VITE_APP_TITLE).toBe('Petri Net Editor');
  });
});
