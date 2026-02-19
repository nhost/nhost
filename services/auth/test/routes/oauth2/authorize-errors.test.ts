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
const DEMO_EMAIL = 'authorize-errors@example.com';
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

/** Run the full auth code flow and return tokens. */
async function getTokens(
  jwt: string,
  clientId: string,
  clientSecret: string,
  extraAuthorizeParams?: Record<string, string>,
) {
  const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state: `auth-err-${Date.now()}`,
    ...extraAuthorizeParams,
  } as any);

  const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
  const requestId = new URL(authResp.headers.get('location')!).searchParams.get('request_id')!;

  const { body: loginResp } = await nhost.auth.oauth2LoginPost(
    { requestId },
    { headers: { Authorization: `Bearer ${jwt}` } },
  );

  const redirectUrl = new URL(loginResp.redirectUri);
  const authCode = redirectUrl.searchParams.get('code')!;

  const { body: tokenResp } = await nhost.auth.oauth2Token({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    client_secret: clientSecret,
  });

  return { tokenResp, redirectUrl };
}

describe('authorize-errors', () => {
  let jwt: string;
  let clientId: string;
  let clientSecret: string;
  let narrowClientId: string;
  let narrowClientSecret: string;

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

    // Create a confidential client with standard scopes via GraphQL
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

    // Create a second client with narrow scopes (openid only) via GraphQL
    const narrowSecret = randomBytes(32).toString('hex');
    const narrowSecretHash = await hashSecret(narrowSecret);
    const { body: { data: narrowData } } = await nhost.graphql.request<{ insertAuthOauth2Client: { clientId: string } }>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) { clientId }
        }`,
        variables: {
          object: {
            clientSecretHash: narrowSecretHash,
            redirectUris: [REDIRECT_URI],
            scopes: ['openid'],
          },
        },
      },
      adminHeaders,
    );
    narrowClientId = narrowData!.insertAuthOauth2Client.clientId;
    narrowClientSecret = narrowSecret;
  });

  // --- GET authorize error cases ---

  it('should reject GET authorize with unknown client_id', async () => {
    const url = nhost.auth.oauth2AuthorizeURL({
      client_id: 'non-existent-client-id',
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid',
    });

    const resp = await fetch(url, { redirect: 'manual' });
    expect(resp.status).toBe(401);

    const body = await resp.json();
    expect(body.error).toBe('invalid_client');
  });

  it('should reject GET authorize with unregistered redirect_uri', async () => {
    const url = nhost.auth.oauth2AuthorizeURL({
      client_id: clientId,
      redirect_uri: 'http://evil.example.com/callback',
      response_type: 'code',
      scope: 'openid',
    });

    const resp = await fetch(url, { redirect: 'manual' });
    expect(resp.status).toBe(400);

    const body = await resp.json();
    expect(body.error).toBe('invalid_request');
  });

  it('should redirect with error for unsupported response_type (GET)', async () => {
    const url = nhost.auth.oauth2AuthorizeURL({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'token',
      scope: 'openid',
    } as any);

    const resp = await fetch(url, { redirect: 'manual' });
    expect(resp.status).toBe(302);

    const location = new URL(resp.headers.get('location')!);
    expect(location.searchParams.get('error')).toBe('unsupported_response_type');
  });

  it('should redirect with error for invalid scope (GET)', async () => {
    const url = nhost.auth.oauth2AuthorizeURL({
      client_id: narrowClientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid admin',
    });

    const resp = await fetch(url, { redirect: 'manual' });
    expect(resp.status).toBe(302);

    const location = new URL(resp.headers.get('location')!);
    expect(location.searchParams.get('error')).toBe('invalid_scope');
  });

  it('should preserve state in error redirect', async () => {
    const url = nhost.auth.oauth2AuthorizeURL({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'token',
      scope: 'openid',
      state: 'my-state-value',
    } as any);

    const resp = await fetch(url, { redirect: 'manual' });
    expect(resp.status).toBe(302);

    const location = new URL(resp.headers.get('location')!);
    expect(location.searchParams.get('error')).toBe('unsupported_response_type');
    expect(location.searchParams.get('state')).toBe('my-state-value');
  });

  it('should preserve state through successful flow', async () => {
    const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'preserve-me',
    });

    const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
    const requestId = new URL(authResp.headers.get('location')!).searchParams.get('request_id')!;

    const { body: loginResp } = await nhost.auth.oauth2LoginPost(
      { requestId },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    const redirectUrl = new URL(loginResp.redirectUri);
    expect(redirectUrl.searchParams.get('state')).toBe('preserve-me');
    expect(redirectUrl.searchParams.get('code')).toBeString();
  });

  it('should include nonce in id_token', async () => {
    const { tokenResp } = await getTokens(jwt, clientId, clientSecret, {
      nonce: 'test-nonce-123',
    });

    const idToken = tokenResp.id_token!;
    expect(idToken).toBeString();

    const payload = jose.decodeJwt(idToken);
    expect(payload.nonce).toBe('test-nonce-123');
  });

  it('should include iss in authorization response (RFC 9207)', async () => {
    const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'iss-test',
    });

    const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
    const requestId = new URL(authResp.headers.get('location')!).searchParams.get('request_id')!;

    const { body: loginResp } = await nhost.auth.oauth2LoginPost(
      { requestId },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    const redirectUrl = new URL(loginResp.redirectUri);
    expect(redirectUrl.searchParams.get('iss')).toBeString();
    expect(redirectUrl.searchParams.get('code')).toBeString();
  });

  // --- POST authorize tests ---

  it('should complete flow via POST authorize (form-encoded)', async () => {
    const url = nhost.auth.oauth2AuthorizePostURL();
    const body = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'post-flow-test',
    });

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'manual',
    });
    expect(resp.status).toBe(302);

    const location = new URL(resp.headers.get('location')!);
    const requestId = location.searchParams.get('request_id')!;
    expect(requestId).toBeString();

    // Complete the flow
    const { body: loginResp } = await nhost.auth.oauth2LoginPost(
      { requestId },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    const redirectUrl = new URL(loginResp.redirectUri);
    const authCode = redirectUrl.searchParams.get('code')!;
    expect(authCode).toBeString();

    const { body: tokenResp } = await nhost.auth.oauth2Token({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      client_secret: clientSecret,
    });

    expect(tokenResp).toEqual({
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: 900,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope: 'openid profile email',
    });
  });

  it('should reject POST authorize with unknown client_id', async () => {
    const url = nhost.auth.oauth2AuthorizePostURL();
    const body = new URLSearchParams({
      client_id: 'non-existent-client-id',
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid',
    });

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'manual',
    });
    expect(resp.status).toBe(401);

    const respBody = await resp.json();
    expect(respBody.error).toBe('invalid_client');
  });

  it('should redirect with error for bad response_type via POST', async () => {
    const url = nhost.auth.oauth2AuthorizePostURL();
    const body = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'token',
      scope: 'openid',
    });

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'manual',
    });
    expect(resp.status).toBe(302);

    const location = new URL(resp.headers.get('location')!);
    expect(location.searchParams.get('error')).toBe('unsupported_response_type');
  });

  it('should reject POST authorize with unregistered redirect_uri', async () => {
    const url = nhost.auth.oauth2AuthorizePostURL();
    const body = new URLSearchParams({
      client_id: clientId,
      redirect_uri: 'http://evil.example.com/callback',
      response_type: 'code',
      scope: 'openid',
    });

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      redirect: 'manual',
    });
    expect(resp.status).toBe(400);

    const respBody = await resp.json();
    expect(respBody.error).toBe('invalid_request');
  });
});
