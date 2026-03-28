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
const DEMO_EMAIL = 'introspect-revoke@example.com';
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

/** Run the full auth code flow and return tokens + client credentials. */
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

  const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state: `ir-${Date.now()}`,
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

  return { tokenResp, clientId, clientSecret };
}

describe('introspect-revoke-errors', () => {
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

  it('should return active:false for garbage token on introspect', async () => {
    const { clientId, clientSecret } = await getTokens(jwt);

    const { body: introspection } = await nhost.auth.oauth2Introspect({
      token: 'garbage-token-that-does-not-exist',
      token_type_hint: 'access_token',
      client_id: clientId,
      client_secret: clientSecret,
    });

    expect(introspection).toEqual({
      active: false,
    });
  });

  it('should reject introspect without client credentials', async () => {
    const { tokenResp } = await getTokens(jwt);

    try {
      await nhost.auth.oauth2Introspect({
        token: tokenResp.access_token,
        token_type_hint: 'access_token',
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should reject introspect with wrong client secret', async () => {
    const { tokenResp, clientId } = await getTokens(jwt);

    try {
      await nhost.auth.oauth2Introspect({
        token: tokenResp.access_token,
        token_type_hint: 'access_token',
        client_id: clientId,
        client_secret: 'wrong-secret',
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should return 200 for revoke of garbage token (RFC 7009)', async () => {
    const { clientId, clientSecret } = await getTokens(jwt);

    // Revoking a non-existent token should succeed (idempotent per RFC 7009)
    await nhost.auth.oauth2Revoke({
      token: 'garbage-token-that-does-not-exist',
      token_type_hint: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
    });

    // If we get here without error, the test passes (200 response)
  });

  it('should return 200 for double-revoke (RFC 7009 idempotency)', async () => {
    const { tokenResp, clientId, clientSecret } = await getTokens(jwt);
    const refreshToken = tokenResp.refresh_token!;

    // First revoke
    await nhost.auth.oauth2Revoke({
      token: refreshToken,
      token_type_hint: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
    });

    // Second revoke — should also succeed
    await nhost.auth.oauth2Revoke({
      token: refreshToken,
      token_type_hint: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
    });

    // Both succeed without error
  });

  it('should reject revoke without client credentials', async () => {
    const { tokenResp } = await getTokens(jwt);

    try {
      await nhost.auth.oauth2Revoke({
        token: tokenResp.refresh_token!,
        token_type_hint: 'refresh_token',
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should reject revoke with wrong client secret', async () => {
    const { tokenResp, clientId } = await getTokens(jwt);

    try {
      await nhost.auth.oauth2Revoke({
        token: tokenResp.refresh_token!,
        token_type_hint: 'refresh_token',
        client_id: clientId,
        client_secret: 'wrong-secret',
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should return active:false when introspecting refresh token with different client', async () => {
    // Client A issues tokens
    const clientA = await getTokens(jwt);
    // Client B is a separate client
    const clientB = await getTokens(jwt);

    // Client B tries to introspect Client A's refresh token
    const { body: introspection } = await nhost.auth.oauth2Introspect({
      token: clientA.tokenResp.refresh_token!,
      token_type_hint: 'refresh_token',
      client_id: clientB.clientId,
      client_secret: clientB.clientSecret,
    });

    expect(introspection).toEqual({
      active: false,
    });
  });

  it('should return active:false when introspecting access token with different client', async () => {
    // Client A issues tokens
    const clientA = await getTokens(jwt);
    // Client B is a separate client
    const clientB = await getTokens(jwt);

    // Client B tries to introspect Client A's access token
    const { body: introspection } = await nhost.auth.oauth2Introspect({
      token: clientA.tokenResp.access_token,
      token_type_hint: 'access_token',
      client_id: clientB.clientId,
      client_secret: clientB.clientSecret,
    });

    expect(introspection).toEqual({
      active: false,
    });
  });

  it('should not revoke a refresh token belonging to a different client', async () => {
    // Client A issues tokens
    const clientA = await getTokens(jwt);
    // Client B is a separate client
    const clientB = await getTokens(jwt);

    // Client B tries to revoke Client A's refresh token — succeeds (200) per RFC 7009
    await nhost.auth.oauth2Revoke({
      token: clientA.tokenResp.refresh_token!,
      token_type_hint: 'refresh_token',
      client_id: clientB.clientId,
      client_secret: clientB.clientSecret,
    });

    // Client A's refresh token should still be active
    const { body: introspection } = await nhost.auth.oauth2Introspect({
      token: clientA.tokenResp.refresh_token!,
      token_type_hint: 'refresh_token',
      client_id: clientA.clientId,
      client_secret: clientA.clientSecret,
    });

    expect(introspection.active).toBe(true);
  });

  it('should introspect access_token without token_type_hint', async () => {
    const { tokenResp, clientId, clientSecret } = await getTokens(jwt);

    const { body: introspection } = await nhost.auth.oauth2Introspect({
      token: tokenResp.access_token,
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
});
