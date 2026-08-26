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
  withRequestHeaders,
} from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';

const adminSecret = 'admin-secret';
const selection: GraphQLPlaygroundSelection = {
  userId: 'user-1',
  role: 'user',
};

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('sends the role without x-hasura-user-id for the Admin selection', () => {
    expect(
      composeRequestHeaders({
        adminSecret,
        selection: { userId: '', role: 'admin' },
      }),
    ).toEqual({
      'content-type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
      'x-hasura-role': 'admin',
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

  it('reports malformed names and values while preserving valid entries', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const onInvalidHeader = vi.fn();

    expect(
      composeRequestHeaders({
        adminSecret,
        selection,
        headersTabOverrides: {
          'Invalid Header': 'ignored',
          'X-Invalid-Value': 'line one\nline two',
          'X-Hasura-Role': 'editor',
          Accept: 'application/json',
        },
        onInvalidHeader,
      }),
    ).toEqual({
      accept: 'application/json',
      'content-type': 'application/json',
      'x-hasura-admin-secret': adminSecret,
      'x-hasura-user-id': 'user-1',
      'x-hasura-role': 'editor',
    });
    expect(onInvalidHeader).toHaveBeenNthCalledWith(1, 'Invalid Header');
    expect(onInvalidHeader).toHaveBeenNthCalledWith(2, 'X-Invalid-Value');
    expect(onInvalidHeader).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenNthCalledWith(
      1,
      'Ignoring invalid GraphQL playground header "Invalid Header" (TypeError).',
    );
    expect(consoleError).toHaveBeenNthCalledWith(
      2,
      'Ignoring invalid GraphQL playground header "X-Invalid-Value" (TypeError).',
    );
  });
});

describe('withRequestHeaders', () => {
  it('sends the selection composed with Headers-tab overrides on wrapped queries', async () => {
    const requestMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue({ json: async () => ({ data: {} }) } as Response);
    const baseFetcher = createGraphiQLFetcher({
      url: 'https://local.graphql.local.nhost.run/v1/graphql',
      fetch: requestMock,
      enableIncrementalDelivery: false,
    });
    const fetcher = withRequestHeaders({
      fetcher: baseFetcher,
      adminSecret,
      selection,
    });
    const graphQLParams = {
      query: 'query TestQuery { messages { id } }',
      operationName: 'TestQuery',
    };

    await fetcher(graphQLParams, {
      documentAST: parse(graphQLParams.query),
      headers: { 'X-Hasura-Role': 'editor' },
    });

    expect(requestMock).toHaveBeenCalledWith(
      'https://local.graphql.local.nhost.run/v1/graphql',
      {
        method: 'POST',
        body: JSON.stringify(graphQLParams),
        headers: {
          'content-type': 'application/json',
          'x-hasura-admin-secret': adminSecret,
          'x-hasura-user-id': 'user-1',
          'x-hasura-role': 'editor',
        },
      },
    );
  });

  it('reports and drops an invalid header once per wrapped request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onInvalidHeader = vi.fn();
    const requestMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue({ json: async () => ({ data: {} }) } as Response);
    const baseFetcher = createGraphiQLFetcher({
      url: 'https://local.graphql.local.nhost.run/v1/graphql',
      fetch: requestMock,
      enableIncrementalDelivery: false,
    });
    const fetcher = withRequestHeaders({
      fetcher: baseFetcher,
      adminSecret,
      selection,
      onInvalidHeader,
    });
    const graphQLParams = {
      query: 'query TestQuery { messages { id } }',
      operationName: 'TestQuery',
    };

    await fetcher(graphQLParams, {
      documentAST: parse(graphQLParams.query),
      headers: {
        'X-Hasura-Role ': 'editor',
        Accept: 'application/json',
      },
    });

    expect(onInvalidHeader).toHaveBeenCalledOnce();
    expect(onInvalidHeader).toHaveBeenCalledWith('X-Hasura-Role ');
    expect(requestMock).toHaveBeenCalledWith(
      'https://local.graphql.local.nhost.run/v1/graphql',
      {
        method: 'POST',
        body: JSON.stringify(graphQLParams),
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-hasura-admin-secret': adminSecret,
          'x-hasura-user-id': 'user-1',
          'x-hasura-role': 'user',
        },
      },
    );
  });

  it('routes wrapped subscriptions through the WebSocket client', async () => {
    const requestMock = vi.fn<typeof fetch>();
    const subscribeMock = vi.fn(
      (
        _payload: SubscribePayload,
        sink: Sink<ExecutionResult>,
      ): VoidFunction => {
        queueMicrotask(() => sink.complete());
        return () => {};
      },
    );
    const baseFetcher = createGraphiQLFetcher({
      url: 'https://local.graphql.local.nhost.run/v1/graphql',
      fetch: requestMock,
      enableIncrementalDelivery: false,
      wsClient: { subscribe: subscribeMock } as unknown as Client,
    });
    const fetcher = withRequestHeaders({
      fetcher: baseFetcher,
      adminSecret,
      selection,
    });
    const graphQLParams = {
      query: 'subscription TestSubscription { messages { id } }',
      operationName: 'TestSubscription',
    };
    const result = fetcher(graphQLParams, {
      documentAST: parse(graphQLParams.query),
      headers: { 'X-Hasura-Role': 'editor' },
    });

    await (result as AsyncIterable<ExecutionResult>)
      [Symbol.asyncIterator]()
      .next();

    expect(subscribeMock).toHaveBeenCalledWith(
      graphQLParams,
      expect.any(Object),
    );
    expect(requestMock).not.toHaveBeenCalled();
  });
});
