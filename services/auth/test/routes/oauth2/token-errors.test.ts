import { describe, it, expect, beforeAll } from 'bun:test';
import { createNhostClient } from '@nhost/nhost-js';
import { FetchError } from '@nhost/nhost-js/fetch';
import { randomBytes } from 'crypto';

import { request, resetEnvironment } from '../../server';

const AUTH_URL = 'http://127.0.0.1:4000';
const HASURA_URL = 'http://127.0.0.1:8080/v1/graphql';
const HASURA_ADMIN_SECRET = 'nhost-admin-secret';
const REDIRECT_URI = 'http://localhost:9999/callback';
const DEMO_EMAIL = 'token-errors@example.com';
const DEMO_PASSWORD = 'Demo1234!';

const nhost = createNhostClient({
  authUrl: AUTH_URL,
  graphqlUrl: HASURA_URL,
  configure: [],
});

const adminHeaders = {
  headers: { 'x-hasura-admin-secret': HASURA_ADMIN_SECRET },
};

async function hashSecret(secret: string): Promise<string> {
  return Bun.password.hash(secret, { algorithm: 'bcrypt', cost: 10 });
}

/** Run the authorize → consent → get-code flow, returns the authorization code. */
async function getAuthCode(jwt: string, clientId: string): Promise<string> {
  const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state: `token-err-${Date.now()}`,
  });

  const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
  const requestId = new URL(authResp.headers.get('location')!).searchParams.get('request_id')!;

  const { body: loginResp } = await nhost.auth.oauth2LoginPost(
    { requestId },
    { headers: { Authorization: `Bearer ${jwt}` } },
  );

  return new URL(loginResp.redirectUri).searchParams.get('code')!;
}

describe('token-errors', () => {
  let jwt: string;
  let clientAId: string;
  let clientASecret: string;
  let clientBId: string;
  let clientBSecret: string;

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

    // Create client A via GraphQL
    const secretA = randomBytes(32).toString('hex');
    const secretAHash = await hashSecret(secretA);
    const { body: { data: dataA } } = await nhost.graphql.request<{ insertAuthOauth2Client: { clientId: string } }>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) { clientId }
        }`,
        variables: {
          object: {
            clientSecretHash: secretAHash,
            redirectUris: [REDIRECT_URI],
            scopes: ['openid', 'profile', 'email'],
          },
        },
      },
      adminHeaders,
    );
    clientAId = dataA!.insertAuthOauth2Client.clientId;
    clientASecret = secretA;

    // Create client B via GraphQL
    const secretB = randomBytes(32).toString('hex');
    const secretBHash = await hashSecret(secretB);
    const { body: { data: dataB } } = await nhost.graphql.request<{ insertAuthOauth2Client: { clientId: string } }>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) { clientId }
        }`,
        variables: {
          object: {
            clientSecretHash: secretBHash,
            redirectUris: [REDIRECT_URI],
            scopes: ['openid', 'profile', 'email'],
          },
        },
      },
      adminHeaders,
    );
    clientBId = dataB!.insertAuthOauth2Client.clientId;
    clientBSecret = secretB;
  });

  it('should reject reused authorization code', async () => {
    const code = await getAuthCode(jwt, clientAId);

    // First use — should succeed
    await nhost.auth.oauth2Token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientAId,
      client_secret: clientASecret,
    });

    // Second use — should fail (code deleted on first use)
    try {
      await nhost.auth.oauth2Token({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientAId,
        client_secret: clientASecret,
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should reject code exchange with wrong redirect_uri', async () => {
    const code = await getAuthCode(jwt, clientAId);

    try {
      await nhost.auth.oauth2Token({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:9999/wrong-callback',
        client_id: clientAId,
        client_secret: clientASecret,
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should reject unsupported grant_type', async () => {
    try {
      await nhost.auth.oauth2Token({
        grant_type: 'client_credentials' as any,
        client_id: clientAId,
        client_secret: clientASecret,
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBe(400);
    }
  });

  it('should reject authorization_code grant without code', async () => {
    try {
      await nhost.auth.oauth2Token({
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        client_id: clientAId,
        client_secret: clientASecret,
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBe(400);
    }
  });

  it('should reject refresh_token grant without refresh_token', async () => {
    try {
      await nhost.auth.oauth2Token({
        grant_type: 'refresh_token',
        client_id: clientAId,
        client_secret: clientASecret,
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBe(400);
    }
  });

  it('should reject refresh with wrong client secret', async () => {
    const code = await getAuthCode(jwt, clientAId);

    const { body: tokenResp } = await nhost.auth.oauth2Token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: clientAId,
      client_secret: clientASecret,
    });

    try {
      await nhost.auth.oauth2Token({
        grant_type: 'refresh_token',
        refresh_token: tokenResp.refresh_token!,
        client_id: clientAId,
        client_secret: 'wrong-secret',
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should reject code exchange with different client_id', async () => {
    // Get code for client A
    const code = await getAuthCode(jwt, clientAId);

    // Try to exchange using client B's credentials
    try {
      await nhost.auth.oauth2Token({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientBId,
        client_secret: clientBSecret,
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should reject code exchange without client_secret for confidential client', async () => {
    const code = await getAuthCode(jwt, clientAId);

    try {
      await nhost.auth.oauth2Token({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientAId,
        // no client_secret
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });
});
