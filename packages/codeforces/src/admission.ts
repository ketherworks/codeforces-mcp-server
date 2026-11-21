import {
  abortable,
  abortError,
  assertNonNegativeSafeInteger,
  assertPositiveSafeInteger,
  throwIfAborted
} from "@kaiserunix/oj-mcp-server-common";

export { abortable, throwIfAborted };

export class CodeforcesQueueFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodeforcesQueueFullError";
  }
}

interface Waiter {
  signal?: AbortSignal;
  resolve: () => void;
  reject: (reason: unknown) => void;
  onAbort?: () => void;
}

export class BoundedAdmission {
  private active = 0;
  private readonly waiters: Waiter[] = [];

  constructor(
    private readonly limit: number,
    private readonly maxQueued: number,
    private readonly queueName: string
  ) {
    assertPositiveSafeInteger(limit, "concurrency limit");
    assertNonNegativeSafeInteger(maxQueued, "queue limit");
  }

  async run<T>(signal: AbortSignal | undefined, operation: () => Promise<T>): Promise<T> {
    await this.acquire(signal);
    try {
      throwIfAborted(signal);
      return await operation();
    } finally {
      this.release();
    }
  }

  private acquire(signal?: AbortSignal): Promise<void> | void {
    throwIfAborted(signal);
    if (this.active < this.limit) {
      this.active += 1;
      return;
    }
    if (this.waiters.length >= this.maxQueued) {
      throw new CodeforcesQueueFullError(`${this.queueName} queue is full.`);
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = { signal, resolve, reject };
      if (signal) {
        waiter.onAbort = () => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(abortError(signal));
        };
        signal.addEventListener("abort", waiter.onAbort, { once: true });
      }
      this.waiters.push(waiter);
    });
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      if (next.signal && next.onAbort) next.signal.removeEventListener("abort", next.onAbort);
      next.resolve();
      return;
    }
    this.active -= 1;
  }
}
