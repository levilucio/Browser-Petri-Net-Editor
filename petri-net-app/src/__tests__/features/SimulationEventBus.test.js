// @ts-check
import { SimulationEventBus } from '../../features/simulation/SimulationEventBus';

describe('SimulationEventBus', () => {
  test('registers, emits, and removes listeners', () => {
    const bus = new SimulationEventBus();
    const handler = jest.fn();

    bus.on('foo', handler);
    expect(bus.listenerCount('foo')).toBe(1);

    const payload = { value: 42 };
    bus.emit('foo', payload);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(payload);

    bus.off('foo', handler);
    expect(bus.listenerCount('foo')).toBe(0);
    bus.emit('foo', payload);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('emit catches listener errors and continues notifying others', () => {
    const bus = new SimulationEventBus();
    const error = new Error('boom');
    const errorListener = jest.fn(() => { throw error; });
    const okListener = jest.fn();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    bus.on('evt', errorListener);
    bus.on('evt', okListener);

    const payload = { x: 1 };
    bus.emit('evt', payload);

    expect(errorListener).toHaveBeenCalledTimes(1);
    expect(okListener).toHaveBeenCalledWith(payload);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('removeAllListeners clears scoped or all listeners', () => {
    const bus = new SimulationEventBus();
    const handlerA = jest.fn();
    const handlerB = jest.fn();

    bus.on('a', handlerA);
    bus.on('b', handlerB);

    bus.removeAllListeners('a');
    expect(bus.listenerCount('a')).toBe(0);
    expect(bus.listenerCount('b')).toBe(1);

    bus.removeAllListeners();
    expect(bus.listenerCount('b')).toBe(0);
  });
});


