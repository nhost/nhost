import { describe, expect, it } from '@jest/globals';
import { createClient } from '@nhost/nhost-js';
import type { FetchError } from '@nhost/nhost-js/fetch';
import type { GraphQLResponse } from '@nhost/nhost-js/graphql';
import gql from 'graphql-tag';

interface GetUsersResponse {
  users: {
    id: string;
    displayName: string;
    metadata: {
      source: string;
    };
  }[];
}

interface UpdateUsersDisplayNameResponse {
  updateUser: {
    id: string;
    displayName: string;
  };
}

describe('Nhost - Sign Up with Email and Password and upload file', () => {
  const nhost = createClient({
    subdomain: 'local',
    region: 'local',
  });

  let userID: string;

  it('should sign up a user with email and password', async () => {
    const resp = await nhost.auth.signUpEmailPassword({
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
      options: {
        displayName: 'Test User',
        locale: 'en',
        defaultRole: 'user',
        allowedRoles: ['user'],
        metadata: {
          source: 'test',
        },
      },
    });

    if (!resp.body.session) {
      throw new Error('Session is null');
    }
  });

  it('query', async () => {
    const users = await nhost.graphql.request<GetUsersResponse>({
      query: `query GetUsers {
          users {
            id
            displayName
            metadata
          }
        }`,
    });

    expect(users.body.data?.users).toBeDefined();
    expect(users.body.data?.users[0].id).toBeDefined();
    expect(users.body.data?.users[0].displayName).toBeDefined();
    expect(users.body.data?.users[0].metadata).toBeDefined();
    expect(users.body.data?.users[0].metadata.source).toBe('test');

    userID = users.body.data?.users[0].id || '';
  });

  it('mutate', async () => {
    const resp = await nhost.graphql.request<UpdateUsersDisplayNameResponse>({
      query: `mutation UpdateUsersDisplayName($id: uuid!, $displayName: String!) {
          updateUser(pk_columns: {id: $id}, _set: {displayName: $displayName}) {
            id
            displayName
          }
        }`,
      variables: {
        id: userID,
        displayName: 'My New Display Name',
      },
      operationName: 'UpdateUsersDisplayName',
    });

    expect(resp.body.data?.updateUser).toBeDefined();
    expect(resp.body.data?.updateUser.id).toBeDefined();
    expect(resp.body.data?.updateUser.displayName).toBe('My New Display Name');
  });

  it('errors: bad query', async () => {
    try {
      await nhost.graphql.request({
        query: `wrong query`,
      });

      expect(true).toBe(false);
    } catch (error) {
      const resp = error as FetchError<GraphQLResponse>;

      expect(resp.body.errors).toBeDefined();
      expect(resp.body.errors).toHaveLength(1);
      // biome-ignore lint/style/noNonNullAssertion: blah
      const errors = resp.body.errors!;
      expect(errors[0].message).toBe('not a valid graphql query');
      expect(error.message).toBe('not a valid graphql query');
      expect(errors[0].extensions?.path).toBe('$.query');
      expect(errors[0].extensions?.code).toBe('validation-failed');
    }
  });

  it("errors: no permissions or doesn't exist", async () => {
    try {
      await nhost.graphql.request({
        query: `query { restricted { id } }`,
      });

      expect(true).toBe(false);
    } catch (error) {
      const resp = error as FetchError<GraphQLResponse>;
      expect(resp.body.errors).toBeDefined();
      expect(resp.body.errors).toHaveLength(1);
      // biome-ignore lint/style/noNonNullAssertion: blah
      const errors = resp.body.errors!;
      expect(errors[0]?.message).toBe(
        "field 'restricted' not found in type: 'query_root'",
      );
      expect(error.message).toBe(
        "field 'restricted' not found in type: 'query_root'",
      );
      expect(errors[0].extensions?.path).toBe('$.selectionSet.restricted');
      expect(errors[0].extensions?.code).toBe('validation-failed');
    }
  });

  it('query with TypedDocumentNode', async () => {
    const GetUsersDocument = gql`
      query GetUsers($limit: Int) {
        users(limit: $limit) {
          id
          displayName
          metadata
        }
      }
    `;

    const users = await nhost.graphql.request<GetUsersResponse>(
      GetUsersDocument,
      {
        limit: 10,
      },
    );

    console.log(users.body.data?.users);

    expect(users.body.data?.users).toBeDefined();
    expect(users.body.data?.users[0].id).toBeDefined();
    expect(users.body.data?.users[0].displayName).toBeDefined();
    expect(users.body.data?.users[0].metadata).toBeDefined();
    expect(users.body.data?.users[0].metadata.source).toBe('test');
  });

  it('query with TypedDocumentNode without variables', async () => {
    const GetUsersDocument = gql`
      query GetUsers($limit: Int) {
        users(limit: $limit) {
          id
          displayName
          metadata
        }
      }
    `;

    const users =
      await nhost.graphql.request<GetUsersResponse>(GetUsersDocument);

    console.log(users.body.data?.users);

    expect(users.body.data?.users).toBeDefined();
    expect(users.body.data?.users[0].id).toBeDefined();
    expect(users.body.data?.users[0].displayName).toBeDefined();
    expect(users.body.data?.users[0].metadata).toBeDefined();
  });

  it('query with TypedDocumentNode errors', async () => {
    try {
      const RestrictedQuery = gql`
        query {
          restricted {
            id
          }
        }
      `;
      await nhost.graphql.request(RestrictedQuery);

      expect(true).toBe(false);
    } catch (error) {
      const resp = error as FetchError<GraphQLResponse>;
      expect(resp.body.errors).toBeDefined();
      expect(resp.body.errors).toHaveLength(1);
      // biome-ignore lint/style/noNonNullAssertion: blah
      const errors = resp.body.errors!;
      expect(errors[0]?.message).toBe(
        "field 'restricted' not found in type: 'query_root'",
      );
      expect(error.message).toBe(
        "field 'restricted' not found in type: 'query_root'",
      );
      expect(errors[0].extensions?.path).toBe('$.selectionSet.restricted');
      expect(errors[0].extensions?.code).toBe('validation-failed');
    }
  });
});
