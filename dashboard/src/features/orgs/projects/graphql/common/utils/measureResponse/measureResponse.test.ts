import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { parse } from 'graphql';
import {
  createResponseMeter,
  createResponseStatusStore,
  formatDuration,
  formatSize,
  type ResponseStatus,
} from '@/features/orgs/projects/graphql/common/utils/measureResponse';

const URL = 'https://local.graphql.local.nhost.run/v1/graphql';
const graphQLParams = {
  query: 'query TestQuery { messages { id } }',
  operationName: 'TestQuery',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function runMeasured(response: Response | Error) {
  const httpFetch = vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) {
      throw response;
    }

    return response;
  });
  const meter = createResponseMeter(httpFetch);
  const fetcher = createGraphiQLFetcher({
    url: URL,
    fetch: meter.fetch,
    enableIncrementalDelivery: false,
  });
  const report = vi.fn<(status: ResponseStatus) => void>();
  const result = meter.measure(
    () => fetcher(graphQLParams, { documentAST: parse(graphQLParams.query) }),
    report,
  );

  const payload = await (result as Promise<unknown>).catch(
    (error: unknown) => error,
  );

  await vi.waitFor(() => {
    expect(report).toHaveBeenCalledTimes(2);
  });

  return { payload, report, httpFetch };
}

describe('createResponseMeter', () => {
  it('reports success with the HTTP status and response size without changing the result', async () => {
    const body = { data: { messages: [{ id: 1 }] } };
    const { payload, report, httpFetch } = await runMeasured(
      jsonResponse(body),
    );

    expect(payload).toEqual(body);
    expect(httpFetch).toHaveBeenCalledWith(URL, {
      method: 'POST',
      body: JSON.stringify(graphQLParams),
      headers: { 'content-type': 'application/json' },
    });
    expect(report).toHaveBeenNthCalledWith(1, { state: 'running' });
    expect(report).toHaveBeenLastCalledWith({
      state: 'success',
      httpStatus: 200,
      durationMs: expect.any(Number),
      sizeBytes: JSON.stringify(body).length,
    });
  });

  it('reports GraphQL errors even when the HTTP status is 200', async () => {
    const { report } = await runMeasured(
      jsonResponse({ errors: [{ message: 'a' }, { message: 'b' }] }),
    );

    expect(report).toHaveBeenLastCalledWith({
      state: 'graphql-error',
      httpStatus: 200,
      durationMs: expect.any(Number),
      errorCount: 2,
    });
  });

  it('reports an HTTP failure with its status code', async () => {
    const { report } = await runMeasured(
      jsonResponse({ errors: [{ message: 'boom' }] }, 500),
    );

    expect(report).toHaveBeenLastCalledWith({
      state: 'failed',
      httpStatus: 500,
      durationMs: expect.any(Number),
    });
  });

  it('reports a network failure without a status code', async () => {
    const error = new TypeError('Failed to fetch');
    const { payload, report } = await runMeasured(error);

    expect(payload).toBe(error);
    expect(report).toHaveBeenLastCalledWith({
      state: 'failed',
      httpStatus: null,
      durationMs: expect.any(Number),
    });
  });

  it('reports subscriptions as live', () => {
    const meter = createResponseMeter(vi.fn<typeof fetch>());
    const iterable = {
      [Symbol.asyncIterator]: () => ({
        next: async () => ({ done: true as const, value: undefined }),
      }),
    };
    const report = vi.fn();

    expect(meter.measure(() => iterable, report)).toBe(iterable);
    expect(report).toHaveBeenCalledWith({ state: 'live' });
  });

  it('does not record requests made outside a measured run', async () => {
    const httpFetch = vi.fn<typeof fetch>(async () =>
      jsonResponse({ data: {} }),
    );
    const meter = createResponseMeter(httpFetch);
    const response = await meter.fetch(URL);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: {} });
  });
});

describe('createResponseStatusStore', () => {
  it('ignores reports from a run that was reset or replaced', () => {
    const store = createResponseStatusStore();
    const firstRun = store.startRun();

    firstRun({ state: 'running' });
    store.reset();
    firstRun({ state: 'live' });

    expect(store.getSnapshot()).toEqual({ state: 'idle' });

    const secondRun = store.startRun();
    const thirdRun = store.startRun();

    secondRun({ state: 'live' });
    thirdRun({ state: 'running' });

    expect(store.getSnapshot()).toEqual({ state: 'running' });
  });
});

describe('formatters', () => {
  it('formats durations and sizes', () => {
    expect(formatDuration(452.6)).toBe('453 ms');
    expect(formatDuration(1234)).toBe('1.23 s');
    expect(formatSize(512)).toBe('512 bytes');
    expect(formatSize(1)).toBe('1 byte');
    expect(formatSize(1229)).toBe('1.2 KB');
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
