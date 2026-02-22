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
const DEMO_EMAIL = 'discovery-jwks@example.com';
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

describe('discovery-jwks', () => {
  beforeAll(async () => {
    await resetEnvironment();
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_OAUTH2_PROVIDER_ENABLED: true,
      AUTH_OAUTH2_PROVIDER_CIMD_ENABLED: true,
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

    expect(discovery).toEqual({
      issuer: "http://127.0.0.2:4000",
      authorization_endpoint: `${issuer}/oauth2/authorize`,
      authorization_response_iss_parameter_supported: true,
      claims_supported: [
        'sub',
        'name',
        'email',
        'email_verified',
        'picture',
        'locale',
        'phone_number',
        'phone_number_verified',
      ],
      client_id_metadata_document_supported: true,
      token_endpoint: `${issuer}/oauth2/token`,
      jwks_uri: `${issuer}/oauth2/jwks`,
      userinfo_endpoint: `${issuer}/oauth2/userinfo`,
      introspection_endpoint: `${issuer}/oauth2/introspect`,
      revocation_endpoint: `${issuer}/oauth2/revoke`,
      request_parameter_supported: false,
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
      scopes_supported: ['openid', 'profile', 'email', 'phone', 'offline_access', 'graphql'],
    });
  });

  it('should return a valid JWKS with at least one key', async () => {
    const { body: jwks } = await nhost.auth.oauth2Jwks();

    expect(jwks.keys.length).toBeGreaterThan(0);
    expect(jwks.keys[0]).toEqual({
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

    // Create an OAuth2 client via GraphQL mutation
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

    // Extract values before toEqual (bun mutates the object with matchers)
    const idToken = tokenResp.id_token!;
    expect(tokenResp).toEqual({
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: 900,
      id_token: expect.any(String),
      refresh_token: expect.any(String),
      scope: 'openid profile email',
    });
    // Decode the id_token — extract values before toEqual (bun mutates objects)
    const header = jose.decodeProtectedHeader(idToken);
    const payload = jose.decodeJwt(idToken);
    const payloadSub = payload.sub;

    expect(header).toEqual({
      alg: 'RS256',
      kid: jwksKid,
      typ: 'JWT',
    });

    expect(payload).toEqual({
      sub: expect.any(String),
      aud: expect.any(String),
      at_hash: expect.any(String),
      auth_time: expect.any(Number),
      iss: discovery.issuer,
      exp: expect.any(Number),
      iat: expect.any(Number),
      email: DEMO_EMAIL,
      email_verified: false,
      locale: 'en',
      name: DEMO_EMAIL,
      picture: expect.stringContaining('gravatar.com'),
    });

    // Verify the JWT signature using the JWKS
    const jwksKeySet = jose.createLocalJWKSet({ keys: jwks.keys } as jose.JSONWebKeySet);
    const { payload: verifiedPayload, protectedHeader } = await jose.jwtVerify(
      idToken,
      jwksKeySet,
    );

    expect(protectedHeader).toEqual({ alg: 'RS256', kid: jwksKid, typ: 'JWT' });
    expect(verifiedPayload).toEqual({
      sub: payloadSub,
      aud: expect.any(String),
      at_hash: expect.any(String),
      auth_time: expect.any(Number),
      iss: discovery.issuer,
      exp: expect.any(Number),
      iat: expect.any(Number),
      email: DEMO_EMAIL,
      email_verified: false,
      locale: 'en',
      name: DEMO_EMAIL,
      picture: expect.stringContaining('gravatar.com'),
    });
  });

  it('should also expose RFC 8414 authorization server metadata', async () => {
    const { body: discovery } = await nhost.auth.getOpenIDConfiguration();
    const { body: asMeta } = await nhost.auth.getOAuthAuthorizationServer();

    expect(asMeta).toEqual(discovery);
  });
});
