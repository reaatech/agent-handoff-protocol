import { describe, expect, it, vi } from 'vitest';
import { TypedEventEmitter } from './events.js';

interface TestEvents {
  test: string;
  count: number;
}

describe('TypedEventEmitter', () => {
  it('emits events to registered listeners', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('test', listener);
    emitter.emit('test', 'hello');

    expect(listener).toHaveBeenCalledWith('hello');
  });

  it('does not call listeners after off', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.on('test', listener);
    emitter.off('test', listener);
    emitter.emit('test', 'hello');

    expect(listener).not.toHaveBeenCalled();
  });

  it('supports once listeners', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const listener = vi.fn();

    emitter.once('test', listener);
    emitter.emit('test', 'first');
    emitter.emit('test', 'second');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('first');
  });

  it('calls multiple listeners', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const a = vi.fn();
    const b = vi.fn();

    emitter.on('test', a);
    emitter.on('test', b);
    emitter.emit('test', 'x');

    expect(a).toHaveBeenCalledWith('x');
    expect(b).toHaveBeenCalledWith('x');
  });

  it('continues emission if a listener throws', () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const bad = vi.fn(() => {
      throw new Error('oops');
    });
    const good = vi.fn();

    emitter.on('test', bad);
    emitter.on('test', good);

    expect(() => {
      emitter.emit('test', 'x');
    }).not.toThrow();
    expect(bad).toHaveBeenCalled();
    expect(good).toHaveBeenCalled();
  });
});
