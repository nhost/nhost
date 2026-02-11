import { describe, it, expect, beforeAll } from 'bun:test';
import { createNhostClient } from '@nhost/nhost-js';
import { FetchError } from '@nhost/nhost-js/fetch';

import { request, resetEnvironment } from '../../server';

const AUTH_URL = 'http://127.0.0.1:4000';
const REDIRECT_URI = 'http://localhost:9999/callback';
const DEMO_EMAIL = 'basic-auth@example.com';
const DEMO_PASSWORD = 'Demo1234!';

const nhost = createNhostClient({
  authUrl: AUTH_URL,
  configure: [],
});

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
}

/** Run the auth code flow up to obtaining an authorization code. */
async function getAuthCode(
  jwt: string,
  clientId: string,
): Promise<string> {
  const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state: `basic-auth-${Date.now()}`,
  });

  const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
  const requestId = new URL(authResp.headers.get('location')!).searchParams.get('request_id')!;

  const { body: loginResp } = await nhost.auth.oauth2LoginPost(
    { requestId },
    { headers: { Authorization: `Bearer ${jwt}` } },
  );

  return new URL(loginResp.redirectUri).searchParams.get('code')!;
}

describe('client_secret_basic authentication (RFC 6749 Section 2.3.1)', () => {
  let jwt: string;
  let clientId: string;
  let clientSecret: string;

  beforeAll(async () => {
    await resetEnvironment();
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_OAUTH2_PROVIDER_ENABLED: true,
      AUTH_OAUTH2_PROVIDER_DCR_ENABLED: true,
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

    // Create a confidential client
    const { body: client } = await nhost.auth.oauth2ClientsCreate(
      {
        clientName: 'Basic Auth Test Client',
        redirectUris: [REDIRECT_URI],
        scopes: ['openid', 'profile', 'email'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_post',
      },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );
    clientId = client.clientId;
    clientSecret = client.clientSecret!;
  });

  it('should exchange authorization code using Basic auth header', async () => {
    const code = await getAuthCode(jwt, clientId);

    const { body: tokenResp } = await nhost.auth.oauth2Token(
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      },
      { headers: { Authorization: basicAuthHeader(clientId, clientSecret) } },
    );

    expect(tokenResp).toMatchObject({
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: expect.any(Number),
      refresh_token: expect.any(String),
      id_token: expect.any(String),
      scope: 'openid profile email',
    });
  });

  it('should refresh token using Basic auth header', async () => {
    const code = await getAuthCode(jwt, clientId);

    const { body: tokens } = await nhost.auth.oauth2Token(
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      },
      { headers: { Authorization: basicAuthHeader(clientId, clientSecret) } },
    );

    const { body: refreshed } = await nhost.auth.oauth2Token(
      {
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token!,
      },
      { headers: { Authorization: basicAuthHeader(clientId, clientSecret) } },
    );

    expect(refreshed).toMatchObject({
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: expect.any(Number),
      refresh_token: expect.any(String),
    });
  });

  it('should introspect token using Basic auth header', async () => {
    const code = await getAuthCode(jwt, clientId);

    const { body: tokens } = await nhost.auth.oauth2Token(
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      },
      { headers: { Authorization: basicAuthHeader(clientId, clientSecret) } },
    );

    const { body: introspection } = await nhost.auth.oauth2Introspect(
      {
        token: tokens.refresh_token!,
        token_type_hint: 'refresh_token',
      },
      { headers: { Authorization: basicAuthHeader(clientId, clientSecret) } },
    );

    expect(introspection).toMatchObject({
      active: true,
      sub: expect.any(String),
      client_id: clientId,
      scope: 'openid profile email',
      token_type: 'refresh_token',
    });
  });

  it('should revoke token using Basic auth header', async () => {
    const code = await getAuthCode(jwt, clientId);

    const { body: tokens } = await nhost.auth.oauth2Token(
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      },
      { headers: { Authorization: basicAuthHeader(clientId, clientSecret) } },
    );

    await nhost.auth.oauth2Revoke(
      {
        token: tokens.refresh_token!,
        token_type_hint: 'refresh_token',
      },
      { headers: { Authorization: basicAuthHeader(clientId, clientSecret) } },
    );

    // Verify it's revoked
    const { body: introspection } = await nhost.auth.oauth2Introspect(
      {
        token: tokens.refresh_token!,
        token_type_hint: 'refresh_token',
      },
      { headers: { Authorization: basicAuthHeader(clientId, clientSecret) } },
    );

    expect(introspection).toMatchObject({ active: false });
  });

  it('should reject Basic auth with wrong secret', async () => {
    const code = await getAuthCode(jwt, clientId);

    try {
      await nhost.auth.oauth2Token(
        {
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
        },
        { headers: { Authorization: basicAuthHeader(clientId, 'wrong-secret') } },
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should reject requests without any client credentials', async () => {
    const code = await getAuthCode(jwt, clientId);

    try {
      await nhost.auth.oauth2Token({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });
});
