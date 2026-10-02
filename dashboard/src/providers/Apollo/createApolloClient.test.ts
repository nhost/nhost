import { gql } from '@apollo/client/core';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

import { createApolloClient } from '@/providers/Apollo/createApolloClient';

const GRAPHQL_URL = 'https://test-project.nhost.run/v1/graphql';

const TEST_QUERY = gql`
  query TestQuery {
    testQuery
  }
`;

const TEST_MUTATION = gql`
  mutation TestMutation {
    testMutation
  }
`;

let requestCount = 0;

const server = setupServer(
  http.post(GRAPHQL_URL, () => {
    requestCount += 1;

    return new HttpResponse('Gateway Timeout', { status: 504 });
  }),
);

describe('createApolloClient', () => {
  beforeAll(() => {
    server.listen();
  });

  beforeEach(() => {
    requestCount = 0;
  });

  afterAll(() => {
    server.close();
  });

  test('does not retry mutations that fail with a network error', async () => {
    const { client } = createApolloClient({ graphqlUrl: GRAPHQL_URL });

    await expect(client.mutate({ mutation: TEST_MUTATION })).rejects.toThrow();

    expect(requestCount).toBe(1);
  });

  test('retries queries that fail with a network error', async () => {
    const { client } = createApolloClient({ graphqlUrl: GRAPHQL_URL });

    await expect(
      client.query({ query: TEST_QUERY, fetchPolicy: 'no-cache' }),
    ).rejects.toThrow();

    expect(requestCount).toBe(5);
  });
});
