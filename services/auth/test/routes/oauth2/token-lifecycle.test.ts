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
const DEMO_EMAIL = 'token-lifecycle@example.com';
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

/** Create a confidential client and run the auth code flow, returns tokens + client credentials. */
async function getTokens(jwt: string) {
  const clientSecret = generateSecret();
  const secretHash = await hashSecret(clientSecret);

  const { body: { data } } = await nhost.graphql.request<{
    insertAuthOauth2Client: { clientId: string };
  }>(
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

  const clientId = data!.insertAuthOauth2Client.clientId;

  // Authorize
  const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state: `lifecycle-${Date.now()}`,
  });

  const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
  const requestId = new URL(authResp.headers.get('location')!).searchParams.get('request_id')!;

  // Consent
  const { body: loginResp } = await nhost.auth.oauth2LoginPost(
    { requestId },
    { headers: { Authorization: `Bearer ${jwt}` } },
  );
  const authCode = new URL(loginResp.redirectUri).searchParams.get('code')!;

  // Exchange
  const { body: tokenResp } = await nhost.auth.oauth2Token({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    client_secret: clientSecret,
  });

  return { tokenResp, clientId, clientSecret };
}

describe('token-lifecycle', () => {
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

  it('should introspect an active access token', async () => {
    const { tokenResp, clientId, clientSecret } = await getTokens(jwt);

    const { body: introspection } = await nhost.auth.oauth2Introspect({
      token: tokenResp.access_token,
      token_type_hint: 'access_token',
      client_id: clientId,
      client_secret: clientSecret,
    });

    expect(introspection).toEqual({
      active: true,
      sub: userId,
      client_id: clientId,
      scope: 'openid profile email',
      exp: expect.any(Number),
      iat: expect.any(Number),
      iss: issuer,
      token_type: 'access_token',
    });
  });

  it('should introspect an active refresh token', async () => {
    const { tokenResp, clientId, clientSecret } = await getTokens(jwt);

    const { body: introspection } = await nhost.auth.oauth2Introspect({
      token: tokenResp.refresh_token!,
      token_type_hint: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
    });

    expect(introspection).toEqual({
      active: true,
      sub: userId,
      client_id: clientId,
      scope: 'openid profile email',
      token_type: 'refresh_token',
      exp: expect.any(Number),
      iat: expect.any(Number),
      iss: issuer,
    });
  });

  it('should rotate refresh tokens (old token becomes inactive)', async () => {
    const { tokenResp, clientId, clientSecret } = await getTokens(jwt);
    const oldRefreshToken = tokenResp.refresh_token!;

    // Refresh the token
    const { body: refreshResp } = await nhost.auth.oauth2Token({
      grant_type: 'refresh_token',
      refresh_token: oldRefreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    expect(refreshResp).toEqual({
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: 900,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope: 'openid profile email',
    });

    // Old refresh token should now be inactive
    const { body: oldIntrospection } = await nhost.auth.oauth2Introspect({
      token: oldRefreshToken,
      token_type_hint: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
    });

    expect(oldIntrospection).toEqual({
      active: false,
    });
  });

  it('should revoke a refresh token (RFC 7009)', async () => {
    const { tokenResp, clientId, clientSecret } = await getTokens(jwt);
    const refreshToken = tokenResp.refresh_token!;

    // Revoke the token
    await nhost.auth.oauth2Revoke({
      token: refreshToken,
      token_type_hint: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
    });

    // Introspect the revoked token — should be inactive
    const { body: introspection } = await nhost.auth.oauth2Introspect({
      token: refreshToken,
      token_type_hint: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
    });

    expect(introspection).toEqual({
      active: false,
    });
  });

  it('should reject refresh with a revoked token', async () => {
    const { tokenResp, clientId, clientSecret } = await getTokens(jwt);
    const refreshToken = tokenResp.refresh_token!;

    // Revoke first
    await nhost.auth.oauth2Revoke({
      token: refreshToken,
      token_type_hint: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
    });

    // Try to use the revoked token — should fail
    try {
      await nhost.auth.oauth2Token({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });
});
