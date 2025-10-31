import { SimulatorFactory } from '../../features/simulation/SimulatorFactory';
import { PTSimulator } from '../../features/simulation/pt-simulator';
import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator';

describe('SimulatorFactory', () => {
  test('creates PT simulator for pt mode', () => {
    const simulator = SimulatorFactory.createSimulator('pt');
    expect(simulator).toBeInstanceOf(PTSimulator);
    expect(simulator.getType()).toBe('pt');
  });

  test('creates algebraic simulator for algebraic mode', () => {
    const simulator = SimulatorFactory.createSimulator('algebraic');
    expect(simulator).toBeInstanceOf(AlgebraicSimulator);
    expect(simulator.getType()).toBe('algebraic');
  });

  test('throws for unknown net mode', () => {
    expect(() => SimulatorFactory.createSimulator('unknown-mode')).toThrow('Unknown net mode');
  });

  test('reports available types and support checks', () => {
    const types = SimulatorFactory.getAvailableTypes();
    expect(types).toEqual(['pt', 'algebraic']);
    expect(SimulatorFactory.isSupported('pt')).toBe(true);
    expect(SimulatorFactory.isSupported('algebraic')).toBe(true);
    expect(SimulatorFactory.isSupported('something-else')).toBe(false);
  });
});



