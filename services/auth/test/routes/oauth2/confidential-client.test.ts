import { describe, it, expect, beforeAll } from 'bun:test';
import { createNhostClient } from '@nhost/nhost-js';
import { FetchError } from '@nhost/nhost-js/fetch';
import * as jose from 'jose';

import { request, resetEnvironment } from '../../server';

const AUTH_URL = 'http://127.0.0.1:4000';
const REDIRECT_URI = 'http://localhost:9999/callback';
const DEMO_EMAIL = 'confidential-client@example.com';
const DEMO_PASSWORD = 'Demo1234!';

const nhost = createNhostClient({
  authUrl: AUTH_URL,
  configure: [],
});

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

    const sessionPayload = jose.decodeJwt(jwt);
    userId = sessionPayload.sub!;
    issuer = sessionPayload.iss!;
  });

  it('should create a confidential client via the admin API and return the secret once', async () => {
    const { body: client } = await nhost.auth.oauth2ClientsCreate(
      {
        clientName: 'Grafana-like Server App',
        redirectUris: [REDIRECT_URI],
        scopes: ['openid', 'profile', 'email'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_post',
      },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    // Extract before toEqual (bun mutates objects with matchers)
    const clientId = client.clientId;

    expect(client).toEqual({
      clientId: expect.any(String),
      clientName: 'Grafana-like Server App',
      clientSecret: expect.any(String),
      redirectUris: [REDIRECT_URI],
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      scopes: ['openid', 'profile', 'email'],
      tokenEndpointAuthMethod: 'client_secret_post',
      isPublic: false,
      accessTokenLifetime: 900,
      refreshTokenLifetime: 2592000,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    // GET the same client — secret should NOT be returned
    const { body: fetched } = await nhost.auth.oauth2ClientsGet(clientId, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(fetched).toEqual({
      clientId,
      clientName: 'Grafana-like Server App',
      redirectUris: [REDIRECT_URI],
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      scopes: ['openid', 'profile', 'email'],
      tokenEndpointAuthMethod: 'client_secret_post',
      isPublic: false,
      accessTokenLifetime: 900,
      refreshTokenLifetime: 2592000,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('should list, update, and delete clients via admin API', async () => {
    const { body: created } = await nhost.auth.oauth2ClientsCreate(
      {
        clientName: 'CRUD Test Client',
        redirectUris: [REDIRECT_URI],
      },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );
    const clientId = created.clientId;

    // List — should contain the new client
    const { body: listResp } = await nhost.auth.oauth2ClientsList({
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const found = listResp.clients.find((c) => c.clientId === clientId);
    expect(found).toEqual({
      clientId,
      clientName: 'CRUD Test Client',
      redirectUris: [REDIRECT_URI],
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      scopes: ['openid', 'profile', 'email'],
      tokenEndpointAuthMethod: 'client_secret_post',
      isPublic: false,
      accessTokenLifetime: 900,
      refreshTokenLifetime: 2592000,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    // Update
    const { body: updated } = await nhost.auth.oauth2ClientsUpdate(
      clientId,
      {
        clientName: 'CRUD Test Client (Updated)',
        redirectUris: [REDIRECT_URI],
      },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );
    expect(updated).toEqual({
      clientId,
      clientName: 'CRUD Test Client (Updated)',
      redirectUris: [REDIRECT_URI],
      grantTypes: ['authorization_code'],
      responseTypes: ['code'],
      scopes: ['openid', 'profile', 'email'],
      tokenEndpointAuthMethod: 'client_secret_post',
      isPublic: false,
      accessTokenLifetime: 900,
      refreshTokenLifetime: 2592000,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    // Delete
    await nhost.auth.oauth2ClientsDelete(clientId, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    // Get after delete — should 404
    try {
      await nhost.auth.oauth2ClientsGet(clientId, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBe(404);
    }
  });

  it('should complete auth code flow with a confidential client (client_secret_post)', async () => {
    // Create client via admin API (like Grafana setup.sh does)
    const { body: client } = await nhost.auth.oauth2ClientsCreate(
      {
        clientName: 'Server-side App',
        redirectUris: [REDIRECT_URI],
        scopes: ['openid', 'profile', 'email'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: 'client_secret_post',
      },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    const clientId = client.clientId;
    const clientSecret = client.clientSecret!;

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
    const { body: client } = await nhost.auth.oauth2ClientsCreate(
      {
        clientName: 'UserInfo Test Server App',
        redirectUris: [REDIRECT_URI],
        scopes: ['openid', 'profile', 'email'],
        tokenEndpointAuthMethod: 'client_secret_post',
      },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    const clientId = client.clientId;
    const clientSecret = client.clientSecret!;

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

  it('should reject token exchange without client_secret for a confidential client', async () => {
    const { body: client } = await nhost.auth.oauth2ClientsCreate(
      {
        clientName: 'No-Secret Rejection Test',
        redirectUris: [REDIRECT_URI],
        tokenEndpointAuthMethod: 'client_secret_post',
      },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    const clientId = client.clientId;

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
