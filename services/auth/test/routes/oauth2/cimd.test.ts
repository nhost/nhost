import { describe, it, expect, beforeAll } from 'bun:test';
import { createNhostClient } from '@nhost/nhost-js';
import { FetchError } from '@nhost/nhost-js/fetch';
import * as jose from 'jose';
import { createHash, randomBytes } from 'crypto';

import { request, resetEnvironment } from '../../server';

const AUTH_URL = 'http://127.0.0.1:4000';
const REDIRECT_URI = 'http://cimd-server/callback';
const DEMO_EMAIL = 'cimd@example.com';
const DEMO_PASSWORD = 'Demo1234!';

// The client_id is the URL where the auth server fetches the metadata document.
// This must match the client_id field inside the metadata JSON and be reachable
// by the auth container via Docker DNS (service name "cimd-server").
const CIMD_CLIENT_ID = 'http://cimd-server/oauth/client-metadata.json';

const nhost = createNhostClient({
  authUrl: AUTH_URL,
  configure: [],
});

function generatePKCE() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** Run authorize → consent → get-code for a CIMD client, returns the authorization code. */
async function getAuthCode(
  jwt: string,
  pkce: { challenge: string },
): Promise<string> {
  const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
    client_id: CIMD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'openid profile email',
    state: `cimd-test-${Date.now()}`,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
  } as any);

  const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
  const requestId = new URL(authResp.headers.get('location')!).searchParams.get('request_id')!;

  const { body: loginResp } = await nhost.auth.oauth2LoginPost(
    { requestId },
    { headers: { Authorization: `Bearer ${jwt}` } },
  );

  return new URL(loginResp.redirectUri).searchParams.get('code')!;
}

describe('cimd', () => {
  let jwt: string;

  beforeAll(async () => {
    await resetEnvironment();
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_OAUTH2_PROVIDER_ENABLED: true,
      AUTH_OAUTH2_PROVIDER_CIMD_ENABLED: true,
      AUTH_OAUTH2_PROVIDER_CIMD_ALLOW_INSECURE_TRANSPORT: true,
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

  it('should advertise CIMD support in discovery metadata', async () => {
    const { body: discovery } = await nhost.auth.getOpenIDConfiguration();

    const issuer = discovery.issuer;
    expect(discovery).toEqual({
      issuer,
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
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['openid', 'profile', 'email', 'phone', 'offline_access', 'graphql'],
    });
  });

  it('should complete a full auth code flow with a CIMD client_id URL and PKCE', async () => {
    const pkce = generatePKCE();

    // Get authorization code using CIMD client_id (a URL)
    const authCode = await getAuthCode(jwt, pkce);
    expect(authCode).toBeString();

    // Exchange code with code_verifier (no client_secret — CIMD clients are public)
    const { body: tokenResp } = await nhost.auth.oauth2Token({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      client_id: CIMD_CLIENT_ID,
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

    // Verify the id_token is a valid JWT with expected claims
    const payload = jose.decodeJwt(idToken);
    expect(payload).toEqual({
      sub: expect.any(String),
      aud: CIMD_CLIENT_ID,
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

  it('should fetch userinfo after CIMD flow', async () => {
    const pkce = generatePKCE();
    const authCode = await getAuthCode(jwt, pkce);

    const { body: tokenResp } = await nhost.auth.oauth2Token({
      grant_type: 'authorization_code',
      code: authCode,
      redirect_uri: REDIRECT_URI,
      client_id: CIMD_CLIENT_ID,
      code_verifier: pkce.verifier,
    });

    const { body: userinfo } = await nhost.auth.oauth2UserinfoGet({
      headers: { Authorization: `Bearer ${tokenResp.access_token}` },
    });

    expect(userinfo).toEqual({
      sub: expect.any(String),
      email: DEMO_EMAIL,
      email_verified: false,
      locale: 'en',
      name: DEMO_EMAIL,
      picture: expect.stringContaining('gravatar.com'),
    });
  });

  it('should reject CIMD flow when code_verifier is missing', async () => {
    const pkce = generatePKCE();
    const authCode = await getAuthCode(jwt, pkce);

    try {
      await nhost.auth.oauth2Token({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: REDIRECT_URI,
        client_id: CIMD_CLIENT_ID,
        // no code_verifier
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should reject an invalid CIMD client_id URL', async () => {
    const pkce = generatePKCE();
    const badClientId = 'http://cimd-server'; // no path — invalid

    const authorizeUrl = nhost.auth.oauth2AuthorizeURL({
      client_id: badClientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile email',
      state: 'cimd-bad-url',
      code_challenge: pkce.challenge,
      code_challenge_method: 'S256',
    } as any);

    const authResp = await fetch(authorizeUrl, { redirect: 'manual' });
    // Should get an error redirect or a non-redirect error
    const location = authResp.headers.get('location');
    if (location) {
      const params = new URL(location).searchParams;
      expect(params.get('error')).toBe('invalid_client');
    } else {
      expect(authResp.status).toBeGreaterThanOrEqual(400);
    }
  });
});
