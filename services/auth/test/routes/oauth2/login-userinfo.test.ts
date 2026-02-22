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
const DEMO_EMAIL = 'login-ui-errors@example.com';
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

/** Run the authorize step and return the request_id (without completing login). */
async function getRequestId(clientId: string): Promise<string> {
  const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state: `login-test-${Date.now()}`,
  });

  const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
  return new URL(authResp.headers.get('location')!).searchParams.get('request_id')!;
}

/** Run full auth code flow and return an OAuth2 access token. */
async function getOAuth2AccessToken(jwt: string, clientId: string, clientSecret: string): Promise<string> {
  const requestId = await getRequestId(clientId);

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

  return tokenResp.access_token;
}

describe('login-userinfo', () => {
  let jwt: string;
  let userId: string;
  let clientId: string;
  let clientSecret: string;

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
    userId = jose.decodeJwt(jwt).sub!;

    // Create a confidential client via GraphQL
    const secret = randomBytes(32).toString('hex');
    const secretHash = await hashSecret(secret);
    const { body: { data } } = await nhost.graphql.request<{ insertAuthOauth2Client: { clientId: string } }>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) { clientId }
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
    clientId = data!.insertAuthOauth2Client.clientId;
    clientSecret = secret;
  });

  // --- GET /oauth2/login tests ---

  it('should return client info for valid request_id via GET /oauth2/login', async () => {
    const requestId = await getRequestId(clientId);

    const { body: loginInfo } = await nhost.auth.oauth2LoginGet({ request_id: requestId });

    expect(loginInfo).toEqual({
      requestId: expect.any(String),
      clientId: clientId,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: REDIRECT_URI,
    });
  });

  it('should reject GET /oauth2/login with unknown request_id', async () => {
    try {
      await nhost.auth.oauth2LoginGet({
        request_id: '00000000-0000-0000-0000-000000000000',
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  // --- POST /oauth2/login tests ---

  it('should reject POST /oauth2/login without authentication', async () => {
    const requestId = await getRequestId(clientId);

    try {
      await nhost.auth.oauth2LoginPost({ requestId });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBe(401);
    }
  });

  it('should reject POST /oauth2/login with already-completed request', async () => {
    const requestId = await getRequestId(clientId);

    // First call completes the request
    await nhost.auth.oauth2LoginPost(
      { requestId },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    // Second call should fail (already completed)
    try {
      await nhost.auth.oauth2LoginPost(
        { requestId },
        { headers: { Authorization: `Bearer ${jwt}` } },
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  // --- Userinfo POST tests ---

  it('should return userinfo via POST method', async () => {
    const accessToken = await getOAuth2AccessToken(jwt, clientId, clientSecret);

    const { body: userinfo } = await nhost.auth.oauth2UserinfoPost({
      headers: { Authorization: `Bearer ${accessToken}` },
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

  it('should reject userinfo POST without access token', async () => {
    try {
      await nhost.auth.oauth2UserinfoPost({});
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should reject userinfo GET without access token', async () => {
    try {
      await nhost.auth.oauth2UserinfoGet({});
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

});
