const TIMEOUT_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT"
]);

export interface DeadlineSignalContext {
  readonly signal: AbortSignal;
  didTimeout(): boolean;
  wasCancelled(): boolean;
}

export interface DeadlineSignalOptions {
  timeoutMessage?: string;
  cancelMessage?: string;
}

export function abortError(signal?: AbortSignal, fallbackMessage = "The operation was aborted."): unknown {
  return signal?.reason ?? new DOMException(fallbackMessage, "AbortError");
}

export function throwIfAborted(signal?: AbortSignal, fallbackMessage?: string): void {
  if (signal?.aborted) {
    throw abortError(signal, fallbackMessage);
  }
}

export function abortable<T>(
  operation: Promise<T>,
  signal?: AbortSignal,
  fallbackMessage?: string
): Promise<T> {
  if (!signal) return operation;
  if (signal.aborted) {
    void operation.catch(() => {
      // Caller already aborted; suppress detached rejection from the abandoned operation.
    });
    return Promise.reject(abortError(signal, fallbackMessage));
  }
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = (): void => {
      finish(() => reject(abortError(signal, fallbackMessage)));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error))
    );
  });
}

export function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: unknown; code?: unknown; cause?: { code?: unknown } };
  return (
    candidate.name === "TimeoutError" ||
    candidate.name === "AbortError" ||
    (typeof candidate.code === "string" && TIMEOUT_ERROR_CODES.has(candidate.code)) ||
    (typeof candidate.cause?.code === "string" && TIMEOUT_ERROR_CODES.has(candidate.cause.code))
  );
}

export async function withDeadlineSignal<T>(
  timeoutMs: number,
  callerSignal: AbortSignal | undefined,
  operation: (context: DeadlineSignalContext) => Promise<T>,
  options: DeadlineSignalOptions = {}
): Promise<T> {
  assertPositiveSafeInteger(timeoutMs, "timeoutMs");
  const controller = new AbortController();
  let timedOut = false;
  const cancelFromCaller = (): void => {
    controller.abort(
      callerSignal?.reason ?? new DOMException(options.cancelMessage ?? "The request was cancelled.", "AbortError")
    );
  };
  if (callerSignal?.aborted) {
    cancelFromCaller();
  } else {
    callerSignal?.addEventListener("abort", cancelFromCaller, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException(options.timeoutMessage ?? "The request timed out.", "TimeoutError"));
  }, timeoutMs);

  try {
    return await operation({
      signal: controller.signal,
      didTimeout: () => timedOut,
      wasCancelled: () => Boolean(callerSignal?.aborted)
    });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", cancelFromCaller);
  }
}

export function assertPositiveSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
  return value;
}

export function assertNonNegativeSafeInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a nonnegative safe integer.`);
  }
  return value;
}
