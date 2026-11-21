import { abortable, assertPositiveSafeInteger, throwIfAborted } from "./abort.js";

export class ResponseSizeLimitError extends RangeError {
  constructor(message = "Response body exceeded the configured byte limit.") {
    super(message);
    this.name = "ResponseSizeLimitError";
  }
}

export class InvalidUtf8BodyError extends Error {
  constructor(message = "Response body was not valid UTF-8.") {
    super(message);
    this.name = "InvalidUtf8BodyError";
  }
}

export interface ReadBodyTextOptions {
  maxBytes: number;
  signal: AbortSignal;
  fatalUtf8?: boolean;
  checkContentLength?: boolean;
  sizeLimitMessage?: string;
  invalidUtf8Message?: string;
}

export function cancelResponseBody(response: Response): void {
  if (!response.body || response.body.locked) return;
  cancelBestEffort(() => response.body!.cancel());
}

export async function cancelResponseBodyAsync(response: Response): Promise<void> {
  if (!response.body || response.body.locked) return;
  try {
    await response.body.cancel();
  } catch {
    // Cleanup must not mask the classified upstream error.
  }
}

export function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  cancelBestEffort(() => reader.cancel());
}

export function cancelBestEffort(cancel: () => Promise<void>): void {
  try {
    void cancel().catch(() => {
      // Cleanup must not replace the upstream classification.
    });
  } catch {
    // Cleanup must not replace the upstream classification.
  }
}

export async function readBodyTextBounded(
  response: Response,
  options: ReadBodyTextOptions
): Promise<string> {
  const maxBytes = assertPositiveSafeInteger(options.maxBytes, "maxBytes");
  if (options.checkContentLength) {
    const declared = response.headers.get("content-length");
    if (declared && /^\d+$/.test(declared) && BigInt(declared) > BigInt(maxBytes)) {
      cancelResponseBody(response);
      throw new ResponseSizeLimitError(options.sizeLimitMessage);
    }
  }
  const reader = response.body?.getReader();
  if (!reader) {
    if (typeof response.text !== "function") return "";
    const text = await abortable(response.text(), options.signal);
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new ResponseSizeLimitError(options.sizeLimitMessage);
    }
    return text;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let completed = false;
  const onAbort = (): void => cancelReader(reader);
  options.signal.addEventListener("abort", onAbort, { once: true });

  try {
    while (true) {
      throwIfAborted(options.signal);
      const { done, value } = await abortable(reader.read(), options.signal);
      throwIfAborted(options.signal);
      if (done) {
        completed = true;
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        cancelReader(reader);
        throw new ResponseSizeLimitError(options.sizeLimitMessage);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (!completed) cancelReader(reader);
    throw error;
  } finally {
    options.signal.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch {
      // Reader may remain locked only while an async cancel settles.
    }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: Boolean(options.fatalUtf8) }).decode(bytes);
  } catch {
    throw new InvalidUtf8BodyError(options.invalidUtf8Message);
  }
}
