import { createGraphiQLFetcher, type Fetcher } from '@graphiql/toolkit';
import { parse } from 'graphql';
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
) {
  const graphiqlFetcher = createGraphiQLFetcher({
    url: 'https://local.graphql.nhost.run/v1/graphql',
    fetch: requestMock,
    enableIncrementalDelivery: false,
  });

  return withRequestHeaders({
    fetcher: graphiqlFetcher,
    adminSecret,
    selection: currentSelection,
  });
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

  it('composes introspection request headers', async () => {
    const requestMock = createRequestMock();
    const fetcher = createTestFetcher(requestMock);

    await fetcher(
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

  it('preserves fetcher options while composing execution headers', () => {
    const delegate = vi.fn<Fetcher>().mockResolvedValue({ data: {} });
    const fetcher = withRequestHeaders({
      fetcher: delegate,
      adminSecret,
      selection,
    });
    const graphQLParams = {
      query: 'subscription TestSubscription { messages { id } }',
      operationName: 'TestSubscription',
    };
    const documentAST = parse(graphQLParams.query);

    fetcher(graphQLParams, {
      documentAST,
      headers: { 'X-Hasura-Role': 'editor' },
    });

    expect(delegate).toHaveBeenCalledWith(graphQLParams, {
      documentAST,
      headers: {
        'content-type': 'application/json',
        'x-hasura-admin-secret': adminSecret,
        'x-hasura-user-id': 'user-1',
        'x-hasura-role': 'editor',
      },
    });
  });
});
