import { createTransport, type SubscriptionClient } from '@graphiql/toolkit';
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

  it('rejects Headers-tab names that are not valid header tokens', () => {
    expect(() =>
      composeRequestHeaders({
        adminSecret,
        selection,
        headersTabOverrides: { 'x hasura role': 'user' },
      }),
    ).toThrow(TypeError);
  });
});

describe('withRequestHeaders', () => {
  const url = 'https://local.graphql.local.nhost.run/v1/graphql';

  function createTestTransport(subscriptionClient?: SubscriptionClient) {
    const requestMock = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ data: {} }), {
          headers: { 'content-type': 'application/json' },
        }),
    );
    const transport = withRequestHeaders({
      transport: createTransport({
        url,
        fetch: requestMock,
        supportedMethods: ['POST'],
        enableIncrementalDelivery: false,
        subscriptionClient,
      }),
      adminSecret,
      selection,
    });

    return { requestMock, transport };
  }

  it('sends the selection composed with Headers-tab overrides on wrapped queries', async () => {
    const { requestMock, transport } = createTestTransport();

    await transport.send({
      query: 'query TestQuery { messages { id } }',
      operationName: 'TestQuery',
      headers: { 'X-Hasura-Role': 'editor' },
    });

    expect(requestMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'POST',
        // The transport adds its own `accept` header.
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-hasura-admin-secret': adminSecret,
          'x-hasura-user-id': 'user-1',
          'x-hasura-role': 'editor',
        }),
      }),
    );
  });

  it('rejects invalid Headers-tab names without sending the request', () => {
    const { requestMock, transport } = createTestTransport();

    expect(() =>
      transport.send({
        query: 'query TestQuery { messages { id } }',
        headers: { 'x hasura role': 'user' },
      }),
    ).toThrow(TypeError);
    expect(requestMock).not.toHaveBeenCalled();
  });

  it('routes wrapped subscriptions through the subscription client', async () => {
    const iterateMock = vi.fn<SubscriptionClient['iterate']>(() =>
      (async function* () {})(),
    );
    const { requestMock, transport } = createTestTransport({
      iterate: iterateMock,
    });
    const result = transport.send({
      query: 'subscription TestSubscription { messages { id } }',
      operationName: 'TestSubscription',
      headers: { 'X-Hasura-Role': 'editor' },
    });

    await (result as AsyncIterable<unknown>)[Symbol.asyncIterator]().next();

    expect(iterateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'subscription TestSubscription { messages { id } }',
        operationName: 'TestSubscription',
      }),
    );
    expect(requestMock).not.toHaveBeenCalled();
  });
});
