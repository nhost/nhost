import { describe, it, expect, beforeAll } from 'bun:test';
import { createNhostClient } from '@nhost/nhost-js';
import { FetchError } from '@nhost/nhost-js/fetch';
import * as jose from 'jose';
import { randomBytes } from 'crypto';

import { request, resetEnvironment } from '../../server';

const AUTH_URL = 'http://127.0.0.1:4000';
const HASURA_URL = 'http://127.0.0.1:8080/v1/graphql';
const HASURA_ADMIN_SECRET = 'nhost-admin-secret';
const REDIRECT_URI = 'http://localhost:9999/callback';
const DEMO_EMAIL = 'confidential-client@example.com';
const DEMO_PASSWORD = 'Demo1234!';

const nhost = createNhostClient({
  authUrl: AUTH_URL,
  graphqlUrl: HASURA_URL,
  configure: [],
});

const adminHeaders = {
  headers: { 'x-hasura-admin-secret': HASURA_ADMIN_SECRET },
};

function generateSecret(): string {
  return randomBytes(32).toString('hex');
}

async function hashSecret(secret: string): Promise<string> {
  return Bun.password.hash(secret, { algorithm: 'bcrypt', cost: 10 });
}

// --- GraphQL response types ---

interface OAuth2Client {
  clientId: string;
  clientSecretHash: string | null;
  redirectUris: string[];
  scopes: string[];
  createdAt: string;
  updatedAt: string;
  metadata: { description: string };
}

interface InsertOAuth2ClientResponse {
  insertAuthOauth2Client: OAuth2Client;
}

interface InsertOAuth2ClientIdResponse {
  insertAuthOauth2Client: Pick<OAuth2Client, 'clientId'>;
}

interface ListOAuth2ClientsResponse {
  authOauth2Clients: OAuth2Client[];
}

interface QueryOAuth2ClientsResponse {
  authOauth2Clients: Pick<OAuth2Client, 'clientId'>[];
}

interface UpdateOAuth2ClientsResponse {
  updateAuthOauth2Clients: {
    returning: Partial<OAuth2Client>[];
  };
}

interface DeleteOAuth2ClientsResponse {
  deleteAuthOauth2Clients: {
    affected_rows: number;
  };
}

const CLIENT_FIELDS = `
  clientId
  clientSecretHash
  redirectUris
  scopes
  createdAt
  updatedAt
  metadata
`;

describe('confidential-client', () => {
  let jwt: string;
  let userId: string;
  let issuer: string;

  beforeAll(async () => {
    await resetEnvironment();
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_OAUTH2_PROVIDER_ENABLED: true,
    });

    try {
      await nhost.auth.signUpEmailPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
    } catch (err) {
      if (!(err instanceof FetchError) || err.status !== 409) {
        throw err;
      }
    }

    const { body: signInResp } = await nhost.auth.signInEmailPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    jwt = signInResp.session!.accessToken;

    const sessionPayload = jose.decodeJwt(jwt);
    userId = sessionPayload.sub!;
    issuer = sessionPayload.iss!;
  });

  it('should create a confidential client and hash the secret', async () => {
    const clientSecret = generateSecret();
    const secretHash = await hashSecret(clientSecret);

    const { body: { data } } = await nhost.graphql.request<InsertOAuth2ClientResponse>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) {
            ${CLIENT_FIELDS}
          }
        }`,
        variables: {
          object: {
            clientSecretHash: secretHash,
            redirectUris: [REDIRECT_URI],
            scopes: ['openid', 'profile', 'email'],
            metadata: { description: 'A third party application' },
          },
        },
      },
      adminHeaders,
    );

    const client = data!.insertAuthOauth2Client;
    const clientId = client.clientId;

    expect(client).toEqual({
      clientId: expect.stringMatching(/^nhoa_/),
      clientSecretHash: expect.stringMatching(/^\$2[aby]?\$10\$/),
      redirectUris: [REDIRECT_URI],
      scopes: ['openid', 'profile', 'email'],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      metadata: {
        description: "A third party application",
      },
    });

    // Query the same client
    const { body: { data: fetchedData } } = await nhost.graphql.request<ListOAuth2ClientsResponse>(
      {
        query: `query ($clientId: String!) {
          authOauth2Clients(where: { clientId: { _eq: $clientId } }) {
            clientId
            redirectUris
            scopes
            createdAt
            updatedAt
            metadata
          }
        }`,
        variables: { clientId },
      },
      adminHeaders,
    );

    expect(fetchedData!.authOauth2Clients).toHaveLength(1);
    expect(fetchedData!.authOauth2Clients[0]).toEqual({
      clientId,
      redirectUris: [REDIRECT_URI],
      scopes: ['openid', 'profile', 'email'],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      metadata: {
        description: "A third party application",
      },
    });
  });

  it('should list, update, and delete clients via GraphQL', async () => {
    const clientSecret = generateSecret();
    const secretHash = await hashSecret(clientSecret);

    const { body: { data: createData } } = await nhost.graphql.request<InsertOAuth2ClientResponse>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) {
            ${CLIENT_FIELDS}
          }
        }`,
        variables: {
          object: {
            clientSecretHash: secretHash,
            redirectUris: [REDIRECT_URI],
            scopes: ['openid', 'profile', 'email'],
            metadata: { description: 'Client for testing CRUD operations' },
          },
        },
      },
      adminHeaders,
    );
    const clientId = createData!.insertAuthOauth2Client.clientId;

    // List — should contain the new client
    const { body: { data: listData } } = await nhost.graphql.request<ListOAuth2ClientsResponse>(
      {
        query: `query {
          authOauth2Clients {
            clientId
            redirectUris
            scopes
            createdAt
            updatedAt
          }
        }`,
      },
      adminHeaders,
    );
    const found = listData!.authOauth2Clients.find(
      (c) => c.clientId === clientId,
    );
    expect(found).toEqual({
      clientId,
      redirectUris: [REDIRECT_URI],
      scopes: ['openid', 'profile', 'email'],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    // Update — changing redirectUris
    const { body: { data: updateData } } = await nhost.graphql.request<UpdateOAuth2ClientsResponse>(
      {
        query: `mutation ($clientId: String!, $changes: authOauth2Clients_set_input!) {
          updateAuthOauth2Clients(
            where: { clientId: { _eq: $clientId } },
            _set: $changes
          ) {
            returning {
              clientId
              redirectUris
              scopes
              createdAt
              updatedAt
            }
          }
        }`,
        variables: {
          clientId,
          changes: {
            redirectUris: [REDIRECT_URI, 'https://example.com/callback2'],
          },
        },
      },
      adminHeaders,
    );
    expect(updateData!.updateAuthOauth2Clients.returning[0]).toEqual({
      clientId,
      redirectUris: [REDIRECT_URI, 'https://example.com/callback2'],
      scopes: ['openid', 'profile', 'email'],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    // Delete
    const { body: { data: deleteData } } = await nhost.graphql.request<DeleteOAuth2ClientsResponse>(
      {
        query: `mutation ($clientId: String!) {
          deleteAuthOauth2Clients(where: { clientId: { _eq: $clientId } }) {
            affected_rows
          }
        }`,
        variables: { clientId },
      },
      adminHeaders,
    );
    expect(deleteData!.deleteAuthOauth2Clients.affected_rows).toBe(1);

    // Query after delete — should be empty
    const { body: { data: afterDelete } } = await nhost.graphql.request<QueryOAuth2ClientsResponse>(
      {
        query: `query ($clientId: String!) {
          authOauth2Clients(where: { clientId: { _eq: $clientId } }) {
            clientId
          }
        }`,
        variables: { clientId },
      },
      adminHeaders,
    );
    expect(afterDelete!.authOauth2Clients).toHaveLength(0);
  });

  it('should complete auth code flow with a confidential client (client_secret_post)', async () => {
    const clientSecret = generateSecret();
    const secretHash = await hashSecret(clientSecret);

    const { body: { data } } = await nhost.graphql.request<InsertOAuth2ClientIdResponse>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) {
            clientId
          }
        }`,
        variables: {
          object: {
            clientSecretHash: secretHash,
            redirectUris: [REDIRECT_URI],
            scopes: ['openid', 'profile', 'email'],
            metadata: { description: 'A server-side app for testing' },
          },
        },
      },
      adminHeaders,
    );

    const clientId = data!.insertAuthOauth2Client.clientId;

    // Authorize
    const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'grafana-test',
    });

    const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
    const requestId = new URL(authResp.headers.get('location')!).searchParams.get('request_id')!;
    expect(requestId).toBeString();

    // Consent
    const { body: loginResp } = await nhost.auth.oauth2LoginPost(
      { requestId },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    const authCode = new URL(loginResp.redirectUri).searchParams.get('code')!;
    expect(authCode).toBeString();

    // Exchange code for tokens (server-side, with client_secret)
    const { body: tokenResp } = await nhost.auth.oauth2Token({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const idToken = tokenResp.id_token!;
    expect(tokenResp).toEqual({
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: 900,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope: 'openid profile email',
    });

    // Verify the id_token
    const payload = jose.decodeJwt(idToken);
    expect(payload).toEqual({
      sub: userId,
      aud: expect.any(String),
      at_hash: expect.any(String),
      auth_time: expect.any(Number),
      iss: issuer,
      exp: expect.any(Number),
      iat: expect.any(Number),
      email: DEMO_EMAIL,
      email_verified: false,
      locale: 'en',
      name: DEMO_EMAIL,
      picture: expect.stringContaining('gravatar.com'),
    });
  });

  it('should fetch userinfo with access token from confidential client flow', async () => {
    const clientSecret = generateSecret();
    const secretHash = await hashSecret(clientSecret);

    const { body: { data } } = await nhost.graphql.request<InsertOAuth2ClientIdResponse>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) {
            clientId
          }
        }`,
        variables: {
          object: {
            clientSecretHash: secretHash,
            redirectUris: [REDIRECT_URI],
            scopes: ['openid', 'profile', 'email'],
            metadata: { description: 'A server-side app for testing userinfo' },
          },
        },
      },
      adminHeaders,
    );

    const clientId = data!.insertAuthOauth2Client.clientId;

    // Auth code flow
    const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'userinfo-server',
    });

    const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
    const requestId = new URL(authResp.headers.get('location')!).searchParams.get('request_id')!;

    const { body: loginResp } = await nhost.auth.oauth2LoginPost(
      { requestId },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );
    const authCode = new URL(loginResp.redirectUri).searchParams.get('code')!;

    const { body: tokenResp } = await nhost.auth.oauth2Token({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      client_secret: clientSecret,
    });

    // Fetch userinfo (like Grafana's GF_AUTH_GENERIC_OAUTH_API_URL)
    const { body: userinfo } = await nhost.auth.oauth2UserinfoGet({
      headers: { Authorization: `Bearer ${tokenResp.access_token}` },
    });

    expect(userinfo).toEqual({
      sub: userId,
      email: DEMO_EMAIL,
      email_verified: false,
      locale: 'en',
      name: DEMO_EMAIL,
      picture: expect.stringContaining('gravatar.com'),
    });
  });

  it('should rotate secret via update and use the new secret', async () => {
    const originalSecret = generateSecret();
    const originalSecretHash = await hashSecret(originalSecret);

    // Create client with original secret
    const { body: { data: createData } } = await nhost.graphql.request<InsertOAuth2ClientResponse>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) {
            ${CLIENT_FIELDS}
          }
        }`,
        variables: {
          object: {
            clientSecretHash: originalSecretHash,
            redirectUris: [REDIRECT_URI],
            scopes: ['openid', 'profile', 'email'],
          },
        },
      },
      adminHeaders,
    );
    const clientId = createData!.insertAuthOauth2Client.clientId;
    const originalHash = createData!.insertAuthOauth2Client.clientSecretHash;

    // Rotate secret — caller must hash and set all derived fields
    const newSecret = generateSecret();
    const newSecretHash = await hashSecret(newSecret);
    const { body: { data: updateData } } = await nhost.graphql.request<UpdateOAuth2ClientsResponse>(
      {
        query: `mutation ($clientId: String!, $changes: authOauth2Clients_set_input!) {
          updateAuthOauth2Clients(
            where: { clientId: { _eq: $clientId } },
            _set: $changes
          ) {
            returning {
              clientSecretHash
            }
          }
        }`,
        variables: {
          clientId,
          changes: {
            clientSecretHash: newSecretHash,
          },
        },
      },
      adminHeaders,
    );

    const updated = updateData!.updateAuthOauth2Clients.returning[0];
    // Hash should have changed and still be bcrypt
    expect(updated.clientSecretHash).toMatch(/^\$2[aby]?\$10\$/);
    expect(updated.clientSecretHash).not.toBe(originalHash);

    // Verify the new secret works in an auth code flow
    const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'rotation-test',
    });

    const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
    const requestId = new URL(authResp.headers.get('location')!).searchParams.get('request_id')!;

    const { body: loginResp } = await nhost.auth.oauth2LoginPost(
      { requestId },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );
    const authCode = new URL(loginResp.redirectUri).searchParams.get('code')!;

    const { body: tokenResp } = await nhost.auth.oauth2Token({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      client_secret: newSecret,
    });
    expect(tokenResp.access_token).toBeString();

    // Verify the old secret no longer works
    const authorizeUrl2 = nhost.auth.oauth2AuthorizeURL({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'rotation-old-secret',
    });

    const authResp2 = await fetch(authorizeUrl2, { redirect: 'manual' });
    const requestId2 = new URL(authResp2.headers.get('location')!).searchParams.get('request_id')!;

    const { body: loginResp2 } = await nhost.auth.oauth2LoginPost(
      { requestId: requestId2 },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );
    const authCode2 = new URL(loginResp2.redirectUri).searchParams.get('code')!;

    try {
      await nhost.auth.oauth2Token({
        grant_type: 'authorization_code',
        code: authCode2,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        client_secret: originalSecret,
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should become public when secret is removed via update', async () => {
    const clientSecret = generateSecret();
    const secretHash = await hashSecret(clientSecret);

    // Create confidential client
    const { body: { data: createData } } = await nhost.graphql.request<InsertOAuth2ClientIdResponse>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) {
            clientId
          }
        }`,
        variables: {
          object: {
            clientSecretHash: secretHash,
            redirectUris: [REDIRECT_URI],
            scopes: ['openid', 'profile', 'email'],
          },
        },
      },
      adminHeaders,
    );
    const clientId = createData!.insertAuthOauth2Client.clientId;

    // Remove secret — just null out the hash
    const { body: { data: updateData } } = await nhost.graphql.request<UpdateOAuth2ClientsResponse>(
      {
        query: `mutation ($clientId: String!, $changes: authOauth2Clients_set_input!) {
          updateAuthOauth2Clients(
            where: { clientId: { _eq: $clientId } },
            _set: $changes
          ) {
            returning {
              clientSecretHash
            }
          }
        }`,
        variables: {
          clientId,
          changes: {
            clientSecretHash: null,
          },
        },
      },
      adminHeaders,
    );

    const updated = updateData!.updateAuthOauth2Clients.returning[0];
    expect(updated.clientSecretHash).toBeNull();
  });

  it('should become confidential when secret is added to a public client via update', async () => {
    // Create public client (no secret)
    const { body: { data: createData } } = await nhost.graphql.request<InsertOAuth2ClientResponse>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) {
            ${CLIENT_FIELDS}
          }
        }`,
        variables: {
          object: {
            redirectUris: [REDIRECT_URI],
            scopes: ['openid', 'profile', 'email'],
          },
        },
      },
      adminHeaders,
    );
    const clientId = createData!.insertAuthOauth2Client.clientId;

    // Verify it was created as public (no secret)
    expect(createData!.insertAuthOauth2Client.clientSecretHash).toBeNull();

    // Add a secret via update
    const newSecret = generateSecret();
    const newSecretHash = await hashSecret(newSecret);
    const { body: { data: updateData } } = await nhost.graphql.request<UpdateOAuth2ClientsResponse>(
      {
        query: `mutation ($clientId: String!, $changes: authOauth2Clients_set_input!) {
          updateAuthOauth2Clients(
            where: { clientId: { _eq: $clientId } },
            _set: $changes
          ) {
            returning {
              clientSecretHash
            }
          }
        }`,
        variables: {
          clientId,
          changes: {
            clientSecretHash: newSecretHash,
          },
        },
      },
      adminHeaders,
    );

    const updated = updateData!.updateAuthOauth2Clients.returning[0];
    expect(updated.clientSecretHash).toMatch(/^\$2[aby]?\$10\$/);
  });

  it('should set created_by directly on insert', async () => {
    const clientSecret = generateSecret();
    const secretHash = await hashSecret(clientSecret);

    // Create client with createdBy set directly
    const { body: { data } } = await nhost.graphql.request<{ insertAuthOauth2Client: { clientId: string } }>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) { clientId }
        }`,
        variables: {
          object: {
            clientSecretHash: secretHash,
            redirectUris: [REDIRECT_URI],
            scopes: ['openid'],
            createdBy: userId,
          },
        },
      },
      adminHeaders,
    );
    const clientId = data!.insertAuthOauth2Client.clientId;

    // Query the client and check createdBy via the relationship
    const { body: { data: fetchData } } = await nhost.graphql.request<{
      authOauth2Clients: Array<{
        clientId: string;
        createdByUser: { id: string } | null;
      }>;
    }>(
      {
        query: `query ($clientId: String!) {
          authOauth2Clients(where: { clientId: { _eq: $clientId } }) {
            clientId
            createdByUser { id }
          }
        }`,
        variables: { clientId },
      },
      adminHeaders,
    );

    expect(fetchData!.authOauth2Clients).toHaveLength(1);
    expect(fetchData!.authOauth2Clients[0].createdByUser).toEqual({ id: userId });
  });

  it('should reject token exchange without client_secret for a confidential client', async () => {
    const clientSecret = generateSecret();
    const secretHash = await hashSecret(clientSecret);

    const { body: { data } } = await nhost.graphql.request<InsertOAuth2ClientIdResponse>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) {
            clientId
          }
        }`,
        variables: {
          object: {
            clientSecretHash: secretHash,
            redirectUris: [REDIRECT_URI],
            scopes: ['openid', 'profile', 'email'],
            metadata: { description: 'A server-side app for testing token exchange without client_secret' },
          },
        },
      },
      adminHeaders,
    );

    const clientId = data!.insertAuthOauth2Client.clientId;

    // Auth code flow
    const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'no-secret-test',
    });

    const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
    const requestId = new URL(authResp.headers.get('location')!).searchParams.get('request_id')!;

    const { body: loginResp } = await nhost.auth.oauth2LoginPost(
      { requestId },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );
    const authCode = new URL(loginResp.redirectUri).searchParams.get('code')!;

    // Exchange without client_secret — should fail
    try {
      await nhost.auth.oauth2Token({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        // no client_secret
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });
});
