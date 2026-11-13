import type { Fetcher } from '@graphiql/toolkit';

export type ResponseStatus =
  | { state: 'idle' }
  | { state: 'running' }
  | { state: 'live' }
  | {
      state: 'success';
      httpStatus: number | null;
      durationMs: number;
      sizeBytes: number | null;
    }
  | {
      state: 'graphql-error';
      httpStatus: number | null;
      durationMs: number;
      errorCount: number;
    }
  | { state: 'failed'; httpStatus: number | null; durationMs: number };

export type ReportResponseStatus = (status: ResponseStatus) => void;

export const IDLE_RESPONSE_STATUS: ResponseStatus = { state: 'idle' };

interface ResponseCapture {
  httpStatus: number | null;
  sizeBytes: Promise<number | null> | null;
}

export interface ResponseMeter {
  /**
   * `fetch` for `createGraphiQLFetcher`. Records the status and size of the
   * response of a measured run and returns the same `Response` unchanged.
   */
  fetch: typeof fetch;
  /**
   * Calls `run` (a fetcher call), reports its status and returns its result
   * unchanged.
   */
  measure: (
    run: () => ReturnType<Fetcher>,
    report: ReportResponseStatus,
  ) => ReturnType<Fetcher>;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
  return (
    typeof value === 'object' && value !== null && Symbol.asyncIterator in value
  );
}

function countErrors(payload: unknown): number {
  const results = Array.isArray(payload) ? payload : [payload];

  return results.reduce<number>((count, result) => {
    const errors = (result as { errors?: unknown } | null)?.errors;

    return count + (Array.isArray(errors) ? errors.length : 0);
  }, 0);
}

function isHttpFailure(httpStatus: number | null) {
  return httpStatus !== null && (httpStatus < 200 || httpStatus >= 300);
}

export function createResponseMeter(
  httpFetch: typeof fetch = (input, init) => fetch(input, init),
): ResponseMeter {
  // The toolkit calls `fetch` synchronously from the fetcher call, so the
  // capture of the run being measured is set only for that call.
  let pendingCapture: ResponseCapture | null = null;

  const meteredFetch: typeof fetch = async (input, init) => {
    const capture = pendingCapture;
    const response = await httpFetch(input, init);

    if (capture) {
      capture.httpStatus = response.status;

      try {
        capture.sizeBytes = response
          .clone()
          .text()
          .then((text) => new Blob([text]).size)
          .catch(() => null);
      } catch {
        capture.sizeBytes = null;
      }
    }

    return response;
  };

  const measure: ResponseMeter['measure'] = (run, report) => {
    const capture: ResponseCapture = { httpStatus: null, sizeBytes: null };
    const startedAt = performance.now();
    let result: ReturnType<Fetcher>;

    pendingCapture = capture;

    try {
      result = run();
    } catch (error) {
      report({
        state: 'failed',
        httpStatus: null,
        durationMs: performance.now() - startedAt,
      });
      throw error;
    } finally {
      pendingCapture = null;
    }

    if (!(result instanceof Promise)) {
      report({ state: 'live' });
      return result;
    }

    report({ state: 'running' });

    result.then(
      async (payload) => {
        const durationMs = performance.now() - startedAt;

        if (isAsyncIterable(payload)) {
          report({ state: 'live' });
          return;
        }

        const { httpStatus } = capture;

        if (isHttpFailure(httpStatus)) {
          report({ state: 'failed', httpStatus, durationMs });
          return;
        }

        const errorCount = countErrors(payload);

        if (errorCount > 0) {
          report({
            state: 'graphql-error',
            httpStatus,
            durationMs,
            errorCount,
          });
          return;
        }

        report({
          state: 'success',
          httpStatus,
          durationMs,
          sizeBytes: (await capture.sizeBytes) ?? null,
        });
      },
      () => {
        report({
          state: 'failed',
          httpStatus: capture.httpStatus,
          durationMs: performance.now() - startedAt,
        });
      },
    );

    return result;
  };

  return { fetch: meteredFetch, measure };
}

export interface ResponseStatusStore {
  getSnapshot: () => ResponseStatus;
  subscribe: (listener: VoidFunction) => VoidFunction;
  /**
   * Starts a run and returns its reporter. A reporter stops updating the
   * store once a newer run starts or the store is reset.
   */
  startRun: () => ReportResponseStatus;
  reset: VoidFunction;
}

export function createResponseStatusStore(): ResponseStatusStore {
  let status: ResponseStatus = IDLE_RESPONSE_STATUS;
  let runId = 0;
  const listeners = new Set<VoidFunction>();

  const setStatus = (nextStatus: ResponseStatus) => {
    status = nextStatus;
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot: () => status,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    startRun: () => {
      runId += 1;
      const currentRunId = runId;

      return (nextStatus) => {
        if (currentRunId === runId) {
          setStatus(nextStatus);
        }
      };
    },
    reset: () => {
      runId += 1;

      if (status !== IDLE_RESPONSE_STATUS) {
        setStatus(IDLE_RESPONSE_STATUS);
      }
    },
  };
}

export function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }

  return `${(durationMs / 1000).toFixed(2)} s`;
}

export function formatSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} ${sizeBytes === 1 ? 'byte' : 'bytes'}`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
