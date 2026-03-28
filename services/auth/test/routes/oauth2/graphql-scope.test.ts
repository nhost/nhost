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
const DEMO_EMAIL = 'scope-claims@example.com';
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_DISPLAY_NAME = 'Test name';

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

/** Run authorize -> consent -> code-exchange, returns the token response. */
async function getTokens(
  jwt: string,
  clientId: string,
  clientSecret: string,
  scope: string,
) {
  const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope,
    state: `scope-test-${Date.now()}`,
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

  return tokenResp;
}

describe('oauth2-scope-claims', () => {
  let jwt: string;
  let userId: string;
  let issuer: string;
  let clientId: string;
  let clientSecret: string;

  beforeAll(async () => {
    await resetEnvironment();
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_OAUTH2_PROVIDER_ENABLED: true,
      AUTH_JWT_CUSTOM_CLAIMS: JSON.stringify({"displayName": "displayName"}),
    });

    try {
      await nhost.auth.signUpEmailPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        options: { displayName: DEMO_DISPLAY_NAME },
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

    // Create a client with all scopes so we can request any subset
    clientSecret = generateSecret();
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
            scopes: ['openid', 'profile', 'email', 'phone', 'graphql'],
          },
        },
      },
      adminHeaders,
    );

    clientId = data!.insertAuthOauth2Client.clientId;
  });

  // --- Access token: graphql scope controls Hasura claims ---

  it('access token should contain Hasura claims when graphql scope is present', async () => {
    const tokenResp = await getTokens(jwt, clientId, clientSecret, 'openid graphql');
    const payload = jose.decodeJwt(tokenResp.access_token);

    expect(payload).toEqual({
      sub: userId,
      aud: clientId,
      scope: 'openid graphql',
      exp: expect.any(Number),
      iat: expect.any(Number),
      iss: issuer,
      'https://hasura.io/jwt/claims': {
        'x-hasura-user-id': userId,
        'x-hasura-default-role': 'user',
        'x-hasura-allowed-roles': expect.arrayContaining(['user']),
        'x-hasura-user-is-anonymous': 'false',
        'x-hasura-displayname': DEMO_DISPLAY_NAME,
      },
    });
  });

  it('access token should omit Hasura claims when graphql scope is absent', async () => {
    const tokenResp = await getTokens(jwt, clientId, clientSecret, 'openid profile email');
    const payload = jose.decodeJwt(tokenResp.access_token);

    expect(payload).toEqual({
      sub: userId,
      aud: clientId,
      scope: 'openid profile email',
      exp: expect.any(Number),
      iat: expect.any(Number),
      iss: issuer,
    });
  });

  // --- ID token: scoped claims ---

  it('id token should contain only base claims with openid scope alone', async () => {
    const tokenResp = await getTokens(jwt, clientId, clientSecret, 'openid');
    const idToken = tokenResp.id_token!;
    const payload = jose.decodeJwt(idToken);

    expect(payload).toEqual({
      sub: userId,
      aud: clientId,
      at_hash: expect.any(String),
      auth_time: expect.any(Number),
      iss: issuer,
      exp: expect.any(Number),
      iat: expect.any(Number),
    });
  });

  it('id token should contain email claims with email scope', async () => {
    const tokenResp = await getTokens(jwt, clientId, clientSecret, 'openid email');
    const idToken = tokenResp.id_token!;
    const payload = jose.decodeJwt(idToken);

    expect(payload).toEqual({
      sub: userId,
      aud: clientId,
      at_hash: expect.any(String),
      auth_time: expect.any(Number),
      iss: issuer,
      exp: expect.any(Number),
      iat: expect.any(Number),
      email: DEMO_EMAIL,
      email_verified: false,
    });
  });

  it('id token should contain profile claims with profile scope', async () => {
    const tokenResp = await getTokens(jwt, clientId, clientSecret, 'openid profile');
    const idToken = tokenResp.id_token!;
    const payload = jose.decodeJwt(idToken);

    expect(payload).toEqual({
      sub: userId,
      aud: clientId,
      at_hash: expect.any(String),
      auth_time: expect.any(Number),
      iss: issuer,
      exp: expect.any(Number),
      iat: expect.any(Number),
      name: DEMO_DISPLAY_NAME,
      locale: 'en',
      picture: expect.stringContaining('gravatar.com'),
    });
  });

  it('id token should omit phone claims when user has no phone number', async () => {
    const tokenResp = await getTokens(jwt, clientId, clientSecret, 'openid phone');
    const idToken = tokenResp.id_token!;
    const payload = jose.decodeJwt(idToken);

    expect(payload).toEqual({
      sub: userId,
      aud: clientId,
      at_hash: expect.any(String),
      auth_time: expect.any(Number),
      iss: issuer,
      exp: expect.any(Number),
      iat: expect.any(Number),
    });
  });

  it('id token should contain both profile and email claims when both scopes present', async () => {
    const tokenResp = await getTokens(jwt, clientId, clientSecret, 'openid profile email');
    const idToken = tokenResp.id_token!;
    const payload = jose.decodeJwt(idToken);

    expect(payload).toEqual({
      sub: userId,
      aud: clientId,
      at_hash: expect.any(String),
      auth_time: expect.any(Number),
      iss: issuer,
      exp: expect.any(Number),
      iat: expect.any(Number),
      name: DEMO_DISPLAY_NAME,
      email: DEMO_EMAIL,
      email_verified: false,
      locale: 'en',
      picture: expect.stringContaining('gravatar.com'),
    });
  });

  // --- Combined: graphql + OIDC scopes ---

  it('graphql scope should not affect id token claims', async () => {
    const tokenResp = await getTokens(jwt, clientId, clientSecret, 'openid profile email graphql');

    // ID token should have profile + email, but no Hasura claims
    const idPayload = jose.decodeJwt(tokenResp.id_token!);
    expect(idPayload).toEqual({
      sub: userId,
      aud: clientId,
      at_hash: expect.any(String),
      auth_time: expect.any(Number),
      iss: issuer,
      exp: expect.any(Number),
      iat: expect.any(Number),
      name: DEMO_DISPLAY_NAME,
      email: DEMO_EMAIL,
      email_verified: false,
      locale: 'en',
      picture: expect.stringContaining('gravatar.com'),
    });

    // Access token should have Hasura claims
    const atPayload = jose.decodeJwt(tokenResp.access_token);
    expect(atPayload['https://hasura.io/jwt/claims']).toEqual({
      'x-hasura-user-id': userId,
      'x-hasura-default-role': 'user',
      'x-hasura-allowed-roles': expect.arrayContaining(['user']),
      'x-hasura-user-is-anonymous': 'false',
      'x-hasura-displayname': DEMO_DISPLAY_NAME,
    });
  });

  // --- Userinfo: graphql scope includes Hasura claims ---

  it('userinfo should contain Hasura claims when graphql scope is present', async () => {
    const tokenResp = await getTokens(jwt, clientId, clientSecret, 'openid profile graphql');

    const { body: userinfo } = await nhost.auth.oauth2UserinfoGet({
      headers: { Authorization: `Bearer ${tokenResp.access_token}` },
    });

    expect(userinfo).toEqual({
      sub: userId,
      name: DEMO_DISPLAY_NAME,
      locale: 'en',
      picture: expect.stringContaining('gravatar.com'),
      'https://hasura.io/jwt/claims': {
        'x-hasura-user-id': userId,
        'x-hasura-default-role': 'user',
        'x-hasura-allowed-roles': expect.arrayContaining(['user']),
        'x-hasura-user-is-anonymous': false,
        'x-hasura-displayname': DEMO_DISPLAY_NAME,
      },
    });
  });

  it('userinfo should omit Hasura claims when graphql scope is absent', async () => {
    const tokenResp = await getTokens(jwt, clientId, clientSecret, 'openid profile');

    const { body: userinfo } = await nhost.auth.oauth2UserinfoGet({
      headers: { Authorization: `Bearer ${tokenResp.access_token}` },
    });

    expect(userinfo).toEqual({
      sub: userId,
      name: DEMO_DISPLAY_NAME,
      locale: 'en',
      picture: expect.stringContaining('gravatar.com'),
    });

    expect(userinfo).not.toHaveProperty('https://hasura.io/jwt/claims');
  });

  // --- Refresh token preserves scope behavior ---

  it('refresh should preserve Hasura claims when graphql scope was in original request', async () => {
    const tokenResp = await getTokens(jwt, clientId, clientSecret, 'openid graphql');

    const { body: refreshResp } = await nhost.auth.oauth2Token({
      grant_type: 'refresh_token',
      refresh_token: tokenResp.refresh_token!,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const payload = jose.decodeJwt(refreshResp.access_token);
    expect(payload['https://hasura.io/jwt/claims']).toEqual({
      'x-hasura-user-id': userId,
      'x-hasura-default-role': 'user',
      'x-hasura-allowed-roles': expect.arrayContaining(['user']),
      'x-hasura-user-is-anonymous': 'false',
      'x-hasura-displayname': DEMO_DISPLAY_NAME,
    });
  });

  it('refresh should omit Hasura claims when graphql scope was not in original request', async () => {
    const tokenResp = await getTokens(jwt, clientId, clientSecret, 'openid profile email');

    const { body: refreshResp } = await nhost.auth.oauth2Token({
      grant_type: 'refresh_token',
      refresh_token: tokenResp.refresh_token!,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const payload = jose.decodeJwt(refreshResp.access_token);
    expect(payload['https://hasura.io/jwt/claims']).toBeUndefined();
  });

  // --- Client scope enforcement ---

  describe('client scope restrictions', () => {
    let limitedClientId: string;
    let limitedClientSecret: string;

    beforeAll(async () => {
      limitedClientSecret = generateSecret();
      const secretHash = await hashSecret(limitedClientSecret);

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
              scopes: ['openid', 'email'],
            },
          },
        },
        adminHeaders,
      );

      limitedClientId = data!.insertAuthOauth2Client.clientId;
    });

    it('should allow requesting a subset of registered scopes', async () => {
      const tokenResp = await getTokens(jwt, limitedClientId, limitedClientSecret, 'openid email');

      expect(tokenResp).toEqual({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 900,
        id_token: expect.any(String),
        refresh_token: expect.any(String),
        scope: 'openid email',
      });

      const idPayload = jose.decodeJwt(tokenResp.id_token!);
      expect(idPayload).toEqual({
        sub: userId,
        aud: limitedClientId,
        at_hash: expect.any(String),
        auth_time: expect.any(Number),
        iss: issuer,
        exp: expect.any(Number),
        iat: expect.any(Number),
        email: DEMO_EMAIL,
        email_verified: false,
      });
    });

    it('should allow requesting only openid when client has openid+email', async () => {
      const tokenResp = await getTokens(jwt, limitedClientId, limitedClientSecret, 'openid');

      expect(tokenResp).toEqual({
        access_token: expect.any(String),
        token_type: 'Bearer',
        expires_in: 900,
        id_token: expect.any(String),
        refresh_token: expect.any(String),
        scope: 'openid',
      });

      const idPayload = jose.decodeJwt(tokenResp.id_token!);
      expect(idPayload).toEqual({
        sub: userId,
        aud: limitedClientId,
        at_hash: expect.any(String),
        auth_time: expect.any(Number),
        iss: issuer,
        exp: expect.any(Number),
        iat: expect.any(Number),
      });
    });

    it('should reject requesting profile scope not registered on the client', async () => {
      const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
        client_id: limitedClientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'openid profile',
        state: `scope-reject-${Date.now()}`,
      });

      const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
      const location = authResp.headers.get('location')!;
      const params = new URL(location).searchParams;

      expect(params.get('error')).toBe('invalid_scope');
    });

    it('should reject requesting graphql scope not registered on the client', async () => {
      const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
        client_id: limitedClientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'openid graphql',
        state: `scope-reject-graphql-${Date.now()}`,
      });

      const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
      const location = authResp.headers.get('location')!;
      const params = new URL(location).searchParams;

      expect(params.get('error')).toBe('invalid_scope');
    });

    it('should reject when any one requested scope is not registered', async () => {
      const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
        client_id: limitedClientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email phone',
        state: `scope-reject-partial-${Date.now()}`,
      });

      const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
      const location = authResp.headers.get('location')!;
      const params = new URL(location).searchParams;

      expect(params.get('error')).toBe('invalid_scope');
    });
  });
});
