import { describe, it, expect, beforeAll } from 'bun:test';
import { createNhostClient } from '@nhost/nhost-js';
import { FetchError } from '@nhost/nhost-js/fetch';
import * as jose from 'jose';

import { request, resetEnvironment } from '../../server';

const AUTH_URL = 'http://127.0.0.1:4000';
const REDIRECT_URI = 'http://localhost:9999/callback';
const DEMO_EMAIL = 'discovery-jwks@example.com';
const DEMO_PASSWORD = 'Demo1234!';

const nhost = createNhostClient({
  authUrl: AUTH_URL,
  configure: [],
});

describe('discovery-jwks', () => {
  beforeAll(async () => {
    await resetEnvironment();
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_OAUTH2_PROVIDER_DCR_ENABLED: true,
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
  });

  it('should return a valid OIDC discovery document', async () => {
    const { body: discovery } = await nhost.auth.getOpenIDConfiguration();
    const issuer = discovery.issuer;

    expect(discovery).toMatchObject({
      issuer: "http://127.0.0.2:4000",
      authorization_endpoint: `${issuer}/oauth2/authorize`,
      token_endpoint: `${issuer}/oauth2/token`,
      jwks_uri: `${issuer}/oauth2/jwks`,
      userinfo_endpoint: `${issuer}/oauth2/userinfo`,
      registration_endpoint: `${issuer}/oauth2/register`,
      introspection_endpoint: `${issuer}/oauth2/introspect`,
      revocation_endpoint: `${issuer}/oauth2/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: [
        'client_secret_basic',
        'client_secret_post',
        'none',
      ],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['openid', 'profile', 'email', 'phone', 'offline_access'],
    });
  });

  it('should return a valid JWKS with at least one key', async () => {
    const { body: jwks } = await nhost.auth.oauth2Jwks();

    expect(jwks.keys.length).toBeGreaterThan(0);
    expect(jwks.keys[0]).toMatchObject({
      kid: expect.any(String),
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      e: 'AQAB',
      n: expect.any(String),
    });
  });

  it('should have a JWKS URI in the discovery document that points to the correct path', async () => {
    const { body: discovery } = await nhost.auth.getOpenIDConfiguration();

    expect(new URL(discovery.jwks_uri).pathname).toBe('/oauth2/jwks');

    const { body: jwks } = await nhost.auth.oauth2Jwks();
    expect(jwks.keys.length).toBeGreaterThan(0);
  });

  it('should obtain an access token via auth code flow and verify its signature with JWKS', async () => {
    // Fetch JWKS and discovery
    const { body: jwks } = await nhost.auth.oauth2Jwks();
    const { body: discovery } = await nhost.auth.getOpenIDConfiguration();
    const jwksKid = (jwks.keys[0] as Record<string, unknown>).kid;

    // Sign in to get a JWT
    const { body: signInResp } = await nhost.auth.signInEmailPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    const jwt = signInResp.session!.accessToken;

    // Register an OAuth2 client via DCR
    const { body: client } = await nhost.auth.oauth2Register(
      {
        client_name: 'JWKS Verification Test',
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

    // Initiate authorization (follow redirect to get request_id)
    const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'jwks-test',
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

    // Extract values before toMatchObject (bun mutates the object with matchers)
    const idToken = tokenResp.id_token!;
    expect(tokenResp).toMatchObject({
      token_type: 'Bearer',
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope: 'openid profile email',
    });
    // Decode the id_token — extract values before toMatchObject (bun mutates objects)
    const header = jose.decodeProtectedHeader(idToken);
    const payload = jose.decodeJwt(idToken);
    const payloadSub = payload.sub;

    expect(header).toMatchObject({
      alg: 'RS256',
      kid: jwksKid,
    });

    expect(payload).toMatchObject({
      iss: discovery.issuer,
      sub: expect.any(String),
      exp: expect.any(Number),
      email: DEMO_EMAIL,
    });

    // Verify the JWT signature using the JWKS
    const jwksKeySet = jose.createLocalJWKSet({ keys: jwks.keys } as jose.JSONWebKeySet);
    const { payload: verifiedPayload, protectedHeader } = await jose.jwtVerify(
      idToken,
      jwksKeySet,
    );

    expect(protectedHeader).toMatchObject({ kid: jwksKid });
    expect(verifiedPayload).toMatchObject({
      iss: discovery.issuer,
      sub: payloadSub,
      email: DEMO_EMAIL,
    });
  });

  it('should also expose RFC 8414 authorization server metadata', async () => {
    const { body: discovery } = await nhost.auth.getOpenIDConfiguration();
    const { body: asMeta } = await nhost.auth.getOAuthAuthorizationServer();

    expect(asMeta).toMatchObject({
      issuer: discovery.issuer,
      authorization_endpoint: discovery.authorization_endpoint,
      token_endpoint: discovery.token_endpoint,
      jwks_uri: discovery.jwks_uri,
    });
  });
});
