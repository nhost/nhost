import { describe, it, expect, beforeAll } from 'bun:test';
import { createNhostClient } from '@nhost/nhost-js';
import { FetchError } from '@nhost/nhost-js/fetch';
import * as jose from 'jose';
import { createHash, randomBytes } from 'crypto';

import { request, resetEnvironment } from '../../server';

const AUTH_URL = 'http://127.0.0.1:4000';
const HASURA_URL = 'http://127.0.0.1:8080/v1/graphql';
const HASURA_ADMIN_SECRET = 'nhost-admin-secret';
const REDIRECT_URI = 'http://localhost:9999/callback';
const DEMO_EMAIL = 'pkce-public@example.com';
const DEMO_PASSWORD = 'Demo1234!';

const nhost = createNhostClient({
  authUrl: AUTH_URL,
  graphqlUrl: HASURA_URL,
  configure: [],
});

const adminHeaders = {
  headers: { 'x-hasura-admin-secret': HASURA_ADMIN_SECRET },
};

function generatePKCE() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** Run the authorize -> consent -> get-code flow, returns the authorization code. */
async function getAuthCode(
  clientId: string,
  jwt: string,
  pkce?: { challenge: string },
): Promise<string> {
  const params: Record<string, string> = {
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state: `pkce-test-${Date.now()}`,
  };
  if (pkce) {
    params.code_challenge = pkce.challenge;
    params.code_challenge_method = 'S256';
  }

  const authorizeUrl = nhost.auth.oauth2AuthorizeURL(params as any);
  const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
  const requestId = new URL(authResp.headers.get('location')!).searchParams.get('request_id')!;

  const { body: loginResp } = await nhost.auth.oauth2LoginPost(
    { requestId },
    { headers: { Authorization: `Bearer ${jwt}` } },
  );

  return new URL(loginResp.redirectUri).searchParams.get('code')!;
}

describe('pkce-public-client', () => {
  let jwt: string;
  let userId: string;
  let clientId: string;

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

    // Create a public client (no secret) via GraphQL mutation
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
            redirectUris: [REDIRECT_URI],
            scopes: ['openid', 'profile', 'email'],
          },
        },
      },
      adminHeaders,
    );

    clientId = data!.insertAuthOauth2Client.clientId;
  });

  it('should create a public client with no client_secret', async () => {
    const { body: { data } } = await nhost.graphql.request<{
      insertAuthOauth2Client: {
        clientId: string;
        clientSecretHash: string | null;
        redirectUris: string[];
        scopes: string[];
      };
    }>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) {
            clientId
            clientSecretHash
            redirectUris
            scopes
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

    const client = data!.insertAuthOauth2Client;
    expect(client).toEqual({
      clientId: expect.stringMatching(/^nhoa_/),
      clientSecretHash: null,
      redirectUris: [REDIRECT_URI],
      scopes: ['openid', 'profile', 'email'],
    });
  });

  it('should complete auth code flow with PKCE (S256) and no client_secret', async () => {
    const pkce = generatePKCE();

    // Get authorization code with PKCE challenge
    const authCode = await getAuthCode(clientId, jwt, pkce);
    expect(authCode).toBeString();

    // Exchange code with code_verifier (no client_secret)
    const { body: tokenResp } = await nhost.auth.oauth2Token({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: pkce.verifier,
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

    const payload = jose.decodeJwt(idToken);
    expect(payload).toEqual({
      sub: userId,
      aud: expect.any(String),
      at_hash: expect.any(String),
      auth_time: expect.any(Number),
      iss: expect.any(String),
      exp: expect.any(Number),
      iat: expect.any(Number),
      email: DEMO_EMAIL,
      email_verified: false,
      locale: 'en',
      name: DEMO_EMAIL,
      picture: expect.stringContaining('gravatar.com'),
    });
  });

  it('should fetch userinfo after PKCE flow', async () => {
    const pkce = generatePKCE();
    const authCode = await getAuthCode(clientId, jwt, pkce);

    const { body: tokenResp } = await nhost.auth.oauth2Token({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: pkce.verifier,
    });

    const accessToken = tokenResp.access_token;
    const { body: userinfo } = await nhost.auth.oauth2UserinfoGet({
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

  it('should reject token exchange when code_verifier is missing', async () => {
    const pkce = generatePKCE();
    const authCode = await getAuthCode(clientId, jwt, pkce);

    // Exchange WITHOUT code_verifier — should fail
    try {
      await nhost.auth.oauth2Token({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        // no code_verifier
      });
      // Should not reach here
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should reject authorize request without PKCE for public client', async () => {
    // Authorize WITHOUT code_challenge — should fail for public clients
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: `no-pkce-test-${Date.now()}`,
      // no code_challenge
    });

    const resp = await fetch(`${AUTH_URL}/oauth2/authorize?${params}`, {
      redirect: 'manual',
    });

    const location = resp.headers.get('location')!;
    const redirectUrl = new URL(location);
    expect(redirectUrl.searchParams.get('error')).toBe('invalid_request');
    expect(redirectUrl.searchParams.get('error_description')).toContain(
      'PKCE',
    );
  });

  it('should reject token exchange when code_verifier is wrong', async () => {
    const pkce = generatePKCE();
    const authCode = await getAuthCode(clientId, jwt, pkce);

    // Exchange with WRONG code_verifier — should fail
    try {
      await nhost.auth.oauth2Token({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: 'totally-wrong-verifier',
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });
});
