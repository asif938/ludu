/**
 * Serializes async operations per key. Used so concurrent seat-join or
 * move requests for the *same room* never interleave, even though the
 * in-memory store has no database-level row locking.
 */
export class KeyedMutex {
  private tails = new Map<string, Promise<unknown>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chained = previous.then(() => gate);
    this.tails.set(key, chained);

    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.tails.get(key) === chained) {
        this.tails.delete(key);
      }
    }
  }
}

export const roomMutex = new KeyedMutex();
