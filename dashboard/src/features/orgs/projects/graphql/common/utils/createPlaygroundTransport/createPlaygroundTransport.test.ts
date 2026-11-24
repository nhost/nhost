import createPlaygroundTransport from './createPlaygroundTransport';

const mocks = vi.hoisted(() => ({ iterate: vi.fn() }));

vi.mock('graphql-ws', () => ({
  createClient: () => ({ iterate: mocks.iterate }),
}));

const QUERY = '{ users { id } }';
const SUBSCRIPTION = 'subscription S { users { id } }';

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

// The transport keeps the fetch it was created with, so mock it first.
function setup(fetchImplementation: typeof window.fetch) {
  vi.spyOn(window, 'fetch').mockImplementation(fetchImplementation);
  const track = vi.fn();
  const transport = createPlaygroundTransport({
    appUrl: 'https://local.graphql.local.nhost.run/v1',
    adminSecret: 's3cret',
    selection: { userId: '', role: 'admin' },
    headersTabOverrides: {},
    track,
  });

  return { track, transport };
}

describe('createPlaygroundTransport analytics', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tracks a run that returns data', async () => {
    const { track, transport } = setup(async () =>
      jsonResponse({ data: { users: [] } }),
    );

    await transport.send({ query: QUERY });

    await vi.waitFor(() => {
      expect(track).toHaveBeenCalledWith('GraphQL Query Run', {
        outcome: 'data',
      });
    });
  });

  it('tracks a run that fails to reach the server', async () => {
    const { track, transport } = setup(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(transport.send({ query: QUERY })).rejects.toThrow();

    await vi.waitFor(() => {
      expect(track).toHaveBeenCalledWith('GraphQL Query Run', {
        outcome: 'request_error',
      });
    });
  });

  it('tracks a response that is not JSON as a request error', async () => {
    const { track, transport } = setup(
      async () =>
        new Response('<html>502 Bad Gateway</html>', {
          status: 502,
          headers: { 'content-type': 'text/html' },
        }),
    );

    await transport.send({ query: QUERY });

    await vi.waitFor(() => {
      expect(track).toHaveBeenCalledWith('GraphQL Query Run', {
        outcome: 'request_error',
      });
    });
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('does not track a stopped run', async () => {
    const { track, transport } = setup(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('The operation was aborted', 'AbortError')),
          );
        }),
    );
    const controller = new AbortController();

    const result = transport.send({ query: QUERY, signal: controller.signal });
    controller.abort();

    await expect(result).rejects.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(track).not.toHaveBeenCalled();
  });

  it('does not track schema fetches', async () => {
    const { track, transport } = setup(async () =>
      jsonResponse({ data: { __schema: {} } }),
    );

    await transport.send({
      query: 'query IntrospectionQuery { __schema { queryType { name } } }',
      operationName: 'IntrospectionQuery',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(track).not.toHaveBeenCalled();
  });
});

describe('createPlaygroundTransport subscriptions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function subscribe() {
    const { transport } = setup(async () => jsonResponse({}));

    const events = transport.send({
      query: SUBSCRIPTION,
    }) as AsyncIterable<unknown>;

    return events[Symbol.asyncIterator]();
  }

  it('reports a closed socket with its code and reason', async () => {
    mocks.iterate.mockReturnValue({
      next: () =>
        Promise.reject(
          new CloseEvent('close', {
            code: 4400,
            reason: 'invalid x-hasura-admin-secret/x-hasura-access-key',
          }),
        ),
      return: async () => ({ done: true, value: undefined }),
    });

    await expect(subscribe().next()).rejects.toThrow(
      new Error(
        'Socket closed with event 4400 invalid x-hasura-admin-secret/x-hasura-access-key',
      ),
    );
  });

  it('stops the socket subscription without waiting for its next event', async () => {
    const socketReturn = vi.fn(async () => ({ done: true, value: undefined }));
    mocks.iterate.mockReturnValue({
      next: () => new Promise(() => {}),
      return: socketReturn,
    });
    const iterator = subscribe();

    // The pending next() call starts the subscription.
    iterator.next();
    await iterator.return?.();

    expect(socketReturn).toHaveBeenCalledTimes(1);
  });
});
