import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { parse } from 'graphql';
import type {
  Client,
  ExecutionResult,
  Sink,
  SubscribePayload,
} from 'graphql-ws';
import {
  composeRequestHeaders,
  type GraphQLPlaygroundSelection,
} from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';

const adminSecret = 'admin-secret';
const selection: GraphQLPlaygroundSelection = {
  userId: 'user-1',
  role: 'user',
};

function createRequestMock() {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify({ data: { __typename: 'query_root' } }), {
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function createTestFetcher(
  requestMock: typeof fetch,
  currentSelection = selection,
  wsClient?: Client,
) {
  const graphiqlFetcher = createGraphiQLFetcher({
    url: 'https://local.graphql.nhost.run/v1/graphql',
    fetch: requestMock,
    enableIncrementalDelivery: false,
    ...(wsClient ? { wsClient } : {}),
  });
  const fetcher: typeof graphiqlFetcher = (graphQLParams, fetcherOpts) =>
    graphiqlFetcher(graphQLParams, {
      ...fetcherOpts,
      headers: composeRequestHeaders({
        adminSecret,
        selection: currentSelection,
        headersTabOverrides: fetcherOpts?.headers,
      }),
    });

  return fetcher;
}

async function sendRequest(
  headersTabOverrides: Record<string, unknown>,
  currentSelection = selection,
) {
  const requestMock = createRequestMock();
  const fetcher = createTestFetcher(requestMock, currentSelection);

  await fetcher(
    { query: 'query TestQuery { __typename }', operationName: 'TestQuery' },
    { headers: headersTabOverrides },
  );

  return requestMock;
}

function getSentHeaders(
  requestMock: ReturnType<typeof createRequestMock>,
): Record<string, string> {
  return requestMock.mock.calls[0][1]?.headers as Record<string, string>;
}

describe('composeRequestHeaders', () => {
  it('composes the base and selector headers', () => {
    expect(composeRequestHeaders({ adminSecret, selection })).toEqual({
      'content-type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
      'x-hasura-user-id': 'user-1',
      'x-hasura-role': 'user',
    });
  });

  it('omits empty selector headers', () => {
    expect(
      composeRequestHeaders({
        adminSecret,
        selection: { userId: '', role: '' },
      }),
    ).toEqual({
      'content-type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
    });
  });

  it('normalizes WebSocket Headers-tab overrides and lets them win', () => {
    expect(
      composeRequestHeaders({
        adminSecret,
        selection,
        headersTabOverrides: {
          'X-Hasura-Role': '',
          'X-Hasura-Admin-Secret': 'override-secret',
          'Content-Type': 'text/plain',
          Accept: 'text/plain',
          'X-Retry-Count': 3,
          'X-Custom-Null': null,
          'X-Custom-Undefined': undefined,
        },
      }),
    ).toEqual({
      accept: 'text/plain',
      'content-type': 'text/plain',
      'x-hasura-admin-secret': 'override-secret',
      'x-hasura-user-id': 'user-1',
      'x-hasura-role': '',
      'x-retry-count': '3',
    });
  });
});

describe('GraphiQL fetcher adapter', () => {
  it('applies mixed-case HTTP overrides exactly once', async () => {
    const requestMock = await sendRequest(
      {
        'X-Hasura-Role': 'editor',
        'X-Hasura-Admin-Secret': 'override-secret',
        'Content-Type': 'application/graphql-response+json',
      },
      { ...selection, role: 'public' },
    );
    const headers = getSentHeaders(requestMock);

    for (const name of [
      'x-hasura-role',
      'x-hasura-admin-secret',
      'content-type',
    ]) {
      expect(
        Object.keys(headers).filter(
          (headerName) => headerName.toLowerCase() === name,
        ),
      ).toEqual([name]);
    }
    expect(headers).toMatchObject({
      'content-type': 'application/graphql-response+json',
      'x-hasura-admin-secret': 'override-secret',
      'x-hasura-role': 'editor',
    });
  });

  it('preserves selection and admin secret after an unrelated Headers-tab edit', async () => {
    const requestMock = await sendRequest({
      'X-Trace-Identifier': 'trace-id',
    });

    expect(getSentHeaders(requestMock)).toMatchObject({
      'x-hasura-admin-secret': adminSecret,
      'x-hasura-user-id': 'user-1',
      'x-hasura-role': 'user',
      'x-trace-identifier': 'trace-id',
    });
  });

  it('passes a Headers-tab Accept override through exactly once', async () => {
    const requestMock = await sendRequest({ Accept: 'text/plain' });
    const headers = getSentHeaders(requestMock);

    expect(
      Object.keys(headers).filter((name) => name.toLowerCase() === 'accept'),
    ).toEqual(['accept']);
    expect(headers.accept).toBe('text/plain');
  });

  it('returns a Promise for introspection and composes the execution headers', async () => {
    const requestMock = createRequestMock();
    const fetcher = createTestFetcher(requestMock);
    const result = fetcher(
      {
        query: 'query IntrospectionQuery { __typename }',
        operationName: 'IntrospectionQuery',
      },
      {
        headers: {
          'X-Hasura-Admin-Secret': 'override-secret',
        },
      },
    );

    expect(result).toBeInstanceOf(Promise);
    await result;

    const headers = getSentHeaders(requestMock);
    expect(
      Object.keys(headers).filter(
        (name) => name.toLowerCase() === 'x-hasura-admin-secret',
      ),
    ).toEqual(['x-hasura-admin-secret']);
    expect(headers).toMatchObject({
      'content-type': 'application/json',
      'x-hasura-admin-secret': 'override-secret',
      'x-hasura-user-id': 'user-1',
      'x-hasura-role': 'user',
    });
  });

  it('preserves documentAST so subscriptions route through the WebSocket client', async () => {
    const requestMock = createRequestMock();
    const subscribeMock = vi.fn(
      (
        _payload: SubscribePayload,
        sink: Sink<ExecutionResult>,
      ): VoidFunction => {
        queueMicrotask(() => {
          sink.next({ data: { messages: [] } });
          sink.complete();
        });

        return () => {};
      },
    );
    const wsClient = { subscribe: subscribeMock } as unknown as Client;
    const fetcher = createTestFetcher(requestMock, selection, wsClient);
    const graphQLParams = {
      query: 'subscription TestSubscription { messages { id } }',
      operationName: 'TestSubscription',
    };
    const result = fetcher(graphQLParams, {
      documentAST: parse(graphQLParams.query),
      headers: { 'X-Hasura-Role': 'editor' },
    });
    const iterator = (result as AsyncIterable<ExecutionResult>)[
      Symbol.asyncIterator
    ]();

    await expect(iterator.next()).resolves.toMatchObject({
      value: { data: { messages: [] } },
    });
    expect(subscribeMock).toHaveBeenCalledWith(
      graphQLParams,
      expect.objectContaining({
        next: expect.any(Function),
        error: expect.any(Function),
        complete: expect.any(Function),
      }),
    );
    expect(requestMock).not.toHaveBeenCalled();
  });
});
