import { getIntrospectionQuery } from 'graphql';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import introspectGraphQLSchema from './introspectGraphQLSchema';

const url = 'http://localhost:1337/v1/graphql';

const defaultOptions = {
  url,
  adminSecret: 'test-admin-secret',
  role: 'user',
};

const introspectionData = {
  __schema: {
    queryType: { name: 'query_root' },
    mutationType: null,
    subscriptionType: null,
    types: [],
    directives: [],
  },
};

let capturedHeaders: Headers | null = null;
let capturedBody: unknown = null;

const server = setupServer(
  http.post(url, async ({ request }) => {
    capturedHeaders = request.headers;
    capturedBody = await request.json();
    return HttpResponse.json({ data: introspectionData });
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  capturedHeaders = null;
  capturedBody = null;
});
afterAll(() => server.close());

describe('introspectGraphQLSchema', () => {
  test('sends the introspection query as the given role', async () => {
    const result = await introspectGraphQLSchema(defaultOptions);

    expect(result).toEqual(introspectionData);
    expect(capturedHeaders?.get('x-hasura-admin-secret')).toBe(
      'test-admin-secret',
    );
    expect(capturedHeaders?.get('x-hasura-role')).toBe('user');
    expect(capturedHeaders?.get('x-hasura-user-id')).toBeNull();
    expect(capturedBody).toEqual({ query: getIntrospectionQuery() });
  });

  test('throws the first GraphQL error message', async () => {
    server.use(
      http.post(url, () =>
        HttpResponse.json({
          errors: [
            { message: 'introspection is disabled for role "user"' },
            { message: 'second error' },
          ],
        }),
      ),
    );

    await expect(introspectGraphQLSchema(defaultOptions)).rejects.toThrow(
      'introspection is disabled for role "user"',
    );
  });

  test('throws the GraphQL error message of a non-2xx response', async () => {
    server.use(
      http.post(url, () =>
        HttpResponse.json(
          { errors: [{ message: 'invalid x-hasura-admin-secret' }] },
          { status: 401 },
        ),
      ),
    );

    await expect(introspectGraphQLSchema(defaultOptions)).rejects.toThrow(
      'invalid x-hasura-admin-secret',
    );
  });

  test('throws the status of a non-2xx response without a JSON body', async () => {
    server.use(
      http.post(url, () => new HttpResponse('Bad Gateway', { status: 502 })),
    );

    await expect(introspectGraphQLSchema(defaultOptions)).rejects.toThrow(
      'Schema introspection failed with status 502.',
    );
  });

  test('throws when the response has no data', async () => {
    server.use(http.post(url, () => HttpResponse.json({ data: null })));

    await expect(introspectGraphQLSchema(defaultOptions)).rejects.toThrow(
      'Schema introspection returned no data.',
    );
  });
});
