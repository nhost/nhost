export type LockMode = 'exclusive' | 'shared';

interface Waiter {
  mode: LockMode;
  grant: VoidFunction;
}

interface LockState {
  mode: LockMode;
  holders: number;
  queue: Waiter[];
}

/**
 * The part of the Web Locks API the SDK and the app use, for one process.
 * Requests for a name are granted in the order they were made: shared ones
 * together, an exclusive one alone. As with Web Locks, a holder that requests
 * the same lock again waits for itself.
 */
export class ProcessLockManager {
  private readonly locks = new Map<string, LockState>();

  async request<T>(
    name: string,
    options: { mode?: LockMode },
    callback: () => T | Promise<T>,
  ): Promise<T> {
    await this.acquire(name, options.mode ?? 'exclusive');
    try {
      return await callback();
    } finally {
      this.release(name);
    }
  }

  private acquire(name: string, mode: LockMode): Promise<void> {
    const state = this.locks.get(name) ?? { mode, holders: 0, queue: [] };
    this.locks.set(name, state);
    return new Promise((resolve) => {
      state.queue.push({ mode, grant: resolve });
      this.grant(state);
    });
  }

  private release(name: string): void {
    const state = this.locks.get(name);
    if (!state) {
      return;
    }
    state.holders -= 1;
    if (state.holders === 0 && state.queue.length === 0) {
      this.locks.delete(name);
      return;
    }
    this.grant(state);
  }

  private grant(state: LockState): void {
    let next = state.queue[0];
    while (
      next &&
      (state.holders === 0 ||
        (state.mode === 'shared' && next.mode === 'shared'))
    ) {
      state.queue.shift();
      state.mode = next.mode;
      state.holders += 1;
      next.grant();
      next = state.queue[0];
    }
  }
}
