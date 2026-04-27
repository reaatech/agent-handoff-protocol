/** Typed event listener function. */
export type EventListener<T> = (payload: T) => void;

/**
 * Lightweight typed event emitter backed by a Map.
 *
 * Provides type-safe `on`, `off`, `once`, and `emit` methods.
 * Individual listener errors are isolated so one failing handler
 * does not break the rest.
 */
export class TypedEventEmitter<EventMap> {
  private readonly listeners = new Map<string, Set<EventListener<unknown>>>();

  on<K extends keyof EventMap>(event: K & string, listener: EventListener<EventMap[K]>): void {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener as EventListener<unknown>);
    this.listeners.set(event, set);
  }

  off<K extends keyof EventMap>(event: K & string, listener: EventListener<EventMap[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener as EventListener<unknown>);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  once<K extends keyof EventMap>(event: K & string, listener: EventListener<EventMap[K]>): void {
    const wrapped = (payload: EventMap[K]): void => {
      this.off(event, wrapped);
      listener(payload);
    };
    this.on(event, wrapped);
  }

  emit<K extends keyof EventMap>(event: K & string, payload: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;

    for (const listener of [...set]) {
      try {
        listener(payload);
      } catch {
        // Continue to next listener even if one throws
      }
    }
  }
}
