// Mock simulator module for testing
const simulator = {
  getEnabledTransitions: jest.fn().mockReturnValue([]),
  fireTransition: jest.fn(),
  fireAllEnabledTransitions: jest.fn(),
  runSimulation: jest.fn(),
  stopSimulation: jest.fn(),
  isSimulationRunning: jest.fn().mockReturnValue(false),
  getSimulationSpeed: jest.fn().mockReturnValue(1000),
  setSimulationSpeed: jest.fn()
};

export default simulator;
