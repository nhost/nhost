import { describe, it, expect, beforeAll } from 'bun:test';
import { createNhostClient } from '@nhost/nhost-js';
import { FetchError } from '@nhost/nhost-js/fetch';
import * as jose from 'jose';

import { request, resetEnvironment } from '../../server';

const AUTH_URL = 'http://127.0.0.1:4000';
const REDIRECT_URI = 'http://localhost:9999/callback';
const DEMO_EMAIL = 'dynamic-registration@example.com';
const DEMO_PASSWORD = 'Demo1234!';

const nhost = createNhostClient({
  authUrl: AUTH_URL,
  configure: [],
});

describe('dynamic-registration', () => {
  let jwt: string;

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
  });

  it('should register a new client via DCR and return correct metadata', async () => {
    const { body: client } = await nhost.auth.oauth2Register(
      {
        client_name: `My Dynamic App (${Date.now()})`,
        redirect_uris: [REDIRECT_URI],
        scope: 'openid profile email',
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
        client_uri: 'https://example.com',
        logo_uri: 'https://example.com/logo.png',
      },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    expect(client).toMatchObject({
      client_id: expect.any(String),
      client_secret: expect.any(String),
      client_name: expect.stringContaining('My Dynamic App'),
      redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      scope: 'openid profile email',
      token_endpoint_auth_method: 'client_secret_post',
      client_secret_expires_at: 0,
    });
  });

  it('should complete a full auth code flow with a dynamically registered client', async () => {
    // Register client
    const { body: client } = await nhost.auth.oauth2Register(
      {
        client_name: `Flow Test Client (${Date.now()})`,
        redirect_uris: [REDIRECT_URI],
        scope: 'openid profile email',
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
      },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    // Extract before toMatchObject (bun mutation quirk)
    const clientId = client.client_id;
    const clientSecret = client.client_secret!;

    // Initiate authorization
    const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'dyn-reg-test',
    });

    const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
    const location = authResp.headers.get('location')!;
    const requestId = new URL(location).searchParams.get('request_id')!;
    expect(requestId).toBeString();

    // Complete login/consent
    const { body: loginResp } = await nhost.auth.oauth2LoginPost(
      { requestId },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    const redirectUrl = new URL(loginResp.redirectUri);
    const authCode = redirectUrl.searchParams.get('code')!;
    expect(authCode).toBeString();

    // Exchange code for tokens
    const { body: tokenResp } = await nhost.auth.oauth2Token({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      client_secret: clientSecret,
    });

    // Extract before toMatchObject
    const idToken = tokenResp.id_token!;
    expect(tokenResp).toMatchObject({
      token_type: 'Bearer',
      id_token: expect.any(String),
      scope: 'openid profile email',
    });

    // Verify the id_token is a valid JWT
    const payload = jose.decodeJwt(idToken);
    expect(payload).toMatchObject({
      sub: expect.any(String),
      email: DEMO_EMAIL,
    });
  });

  it('should fetch userinfo with the access token from a dynamically registered client', async () => {
    // Register client
    const { body: client } = await nhost.auth.oauth2Register(
      {
        client_name: `UserInfo Test Client (${Date.now()})`,
        redirect_uris: [REDIRECT_URI],
        scope: 'openid profile email',
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'client_secret_post',
      },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    const clientId = client.client_id;
    const clientSecret = client.client_secret!;

    // Auth code flow
    const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'userinfo-test',
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

    // Fetch userinfo with the access token
    const accessToken = tokenResp.access_token;
    const { body: userinfo } = await nhost.auth.oauth2UserinfoGet({
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(userinfo).toMatchObject({
      sub: expect.any(String),
      email: DEMO_EMAIL,
    });
  });
});
