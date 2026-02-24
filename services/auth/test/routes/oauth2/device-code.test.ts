import { describe, it, expect, beforeAll } from 'bun:test';
import { createNhostClient } from '@nhost/nhost-js';
import { FetchError } from '@nhost/nhost-js/fetch';
import * as jose from 'jose';

import { request, resetEnvironment } from '../../server';

const AUTH_URL = 'http://127.0.0.1:4000';
const HASURA_URL = 'http://127.0.0.1:8080/v1/graphql';
const HASURA_ADMIN_SECRET = 'nhost-admin-secret';
const DEMO_EMAIL = 'device-code@example.com';
const DEMO_PASSWORD = 'Demo1234!';

const nhost = createNhostClient({
  authUrl: AUTH_URL,
  graphqlUrl: HASURA_URL,
  configure: [],
});

const adminHeaders = {
  headers: { 'x-hasura-admin-secret': HASURA_ADMIN_SECRET },
};

/**
 * Poll POST /oauth2/token with device_code grant.
 * Uses raw fetch because the SDK throws on non-2xx and we need to inspect
 * intermediate OAuth2 errors (authorization_pending, slow_down, access_denied).
 */
async function deviceTokenPoll(params: {
  deviceCode: string;
  clientId: string;
  clientSecret?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const form = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: params.deviceCode,
    client_id: params.clientId,
  });
  if (params.clientSecret) form.set('client_secret', params.clientSecret);

  const res = await fetch(`${AUTH_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

describe('device-code', () => {
  let jwt: string;
  let userId: string;
  let publicClientId: string;

  beforeAll(async () => {
    await resetEnvironment();
    await request.post('/change-env').send({
      AUTH_DISABLE_NEW_USERS: false,
      AUTH_EMAIL_SIGNIN_EMAIL_VERIFIED_REQUIRED: false,
      AUTH_OAUTH2_PROVIDER_ENABLED: true,
    });

    // Create or sign in the test user
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

    // Create a public OAuth2 client (no secret — typical for device flow)
    const {
      body: { data },
    } = await nhost.graphql.request<{
      insertAuthOauth2Client: { clientId: string };
    }>(
      {
        query: `mutation ($object: authOauth2Clients_insert_input!) {
          insertAuthOauth2Client(object: $object) { clientId }
        }`,
        variables: {
          object: {
            redirectUris: ['http://localhost:9999/callback'],
            scopes: ['openid', 'profile', 'email'],
          },
        },
      },
      adminHeaders,
    );

    publicClientId = data!.insertAuthOauth2Client.clientId;
  });

  // ── Discovery ──────────────────────────────────────────────────

  it('should include device_authorization_endpoint in discovery', async () => {
    const { body: discovery } = await nhost.auth.getOpenIDConfiguration();
    const issuer = discovery.issuer as string;

    expect(discovery.device_authorization_endpoint).toBe(`${issuer}/oauth2/device`);
    expect(discovery.grant_types_supported).toContain(
      'urn:ietf:params:oauth:grant-type:device_code',
    );
  });

  // ── Device Authorization (POST /oauth2/device) ────────────────

  it('should return a device authorization response', async () => {
    const { body } = await nhost.auth.oauth2DeviceAuthorization({
      client_id: publicClientId,
      scope: 'openid profile email',
    });

    expect(body).toEqual({
      device_code: expect.any(String),
      user_code: expect.stringMatching(/^[A-Z]{4}-[A-Z]{4}$/),
      verification_uri: expect.any(String),
      verification_uri_complete: expect.any(String),
      expires_in: expect.any(Number),
      interval: expect.any(Number),
    });
    expect(body.expires_in).toBeGreaterThan(0);
    expect(body.interval).toBeGreaterThan(0);
  });

  it('should use default client scopes when scope is omitted', async () => {
    const { status } = await nhost.auth.oauth2DeviceAuthorization({
      client_id: publicClientId,
    });
    expect(status).toBe(200);
  });

  it('should reject unknown client_id', async () => {
    try {
      await nhost.auth.oauth2DeviceAuthorization({
        client_id: 'nonexistent_client',
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      const fe = err as FetchError<{ error: string }>;
      expect(fe.status).toBeGreaterThanOrEqual(400);
      expect(fe.body.error).toBe('invalid_client');
    }
  });

  it('should reject invalid scope', async () => {
    try {
      await nhost.auth.oauth2DeviceAuthorization({
        client_id: publicClientId,
        scope: 'bogus_scope',
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      const fe = err as FetchError<{ error: string }>;
      expect(fe.status).toBeGreaterThanOrEqual(400);
      expect(fe.body.error).toBe('invalid_scope');
    }
  });

  // ── Verify GET (GET /oauth2/device/verify) ────────────────────

  it('should return client_id and scopes for a valid user_code', async () => {
    const { body: authBody } = await nhost.auth.oauth2DeviceAuthorization({
      client_id: publicClientId,
      scope: 'openid',
    });

    const { body } = await nhost.auth.oauth2DeviceVerifyGet(
      { user_code: authBody.user_code },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    expect(body.clientId).toBe(publicClientId);
    expect(body.scopes).toEqual(['openid']);
  });

  it('should reject an invalid user_code', async () => {
    try {
      await nhost.auth.oauth2DeviceVerifyGet(
        { user_code: 'ZZZZ-ZZZZ' },
        { headers: { Authorization: `Bearer ${jwt}` } },
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  // ── Verify POST (POST /oauth2/device/verify) ─────────────────

  it('should reject verify without authentication', async () => {
    const { body: authBody } = await nhost.auth.oauth2DeviceAuthorization({
      client_id: publicClientId,
      scope: 'openid',
    });

    try {
      await nhost.auth.oauth2DeviceVerifyPost({
        userCode: authBody.user_code,
        action: 'approve',
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  it('should approve a device request', async () => {
    const { body: authBody } = await nhost.auth.oauth2DeviceAuthorization({
      client_id: publicClientId,
      scope: 'openid',
    });

    const { body } = await nhost.auth.oauth2DeviceVerifyPost(
      { userCode: authBody.user_code, action: 'approve' },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    expect(body.clientId).toBe(publicClientId);
    expect(body.scopes).toEqual(['openid']);
  });

  it('should deny a device request', async () => {
    const { body: authBody } = await nhost.auth.oauth2DeviceAuthorization({
      client_id: publicClientId,
      scope: 'openid',
    });

    const { status } = await nhost.auth.oauth2DeviceVerifyPost(
      { userCode: authBody.user_code, action: 'deny' },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    expect(status).toBe(200);
  });

  it('should reject approving an already-approved code', async () => {
    const { body: authBody } = await nhost.auth.oauth2DeviceAuthorization({
      client_id: publicClientId,
      scope: 'openid',
    });

    await nhost.auth.oauth2DeviceVerifyPost(
      { userCode: authBody.user_code, action: 'approve' },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    try {
      await nhost.auth.oauth2DeviceVerifyPost(
        { userCode: authBody.user_code, action: 'approve' },
        { headers: { Authorization: `Bearer ${jwt}` } },
      );
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      expect((err as FetchError).status).toBeGreaterThanOrEqual(400);
    }
  });

  // ── Token exchange (POST /oauth2/token) ───────────────────────

  it('should return authorization_pending before user approves', async () => {
    const { body: authBody } = await nhost.auth.oauth2DeviceAuthorization({
      client_id: publicClientId,
      scope: 'openid',
    });

    const { status, body } = await deviceTokenPoll({
      deviceCode: authBody.device_code,
      clientId: publicClientId,
    });

    expect(status).toBe(400);
    expect(body.error).toBe('authorization_pending');
  });

  it('should return access_denied when user denies', async () => {
    const { body: authBody } = await nhost.auth.oauth2DeviceAuthorization({
      client_id: publicClientId,
      scope: 'openid',
    });

    await nhost.auth.oauth2DeviceVerifyPost(
      { userCode: authBody.user_code, action: 'deny' },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    const { status, body } = await deviceTokenPoll({
      deviceCode: authBody.device_code,
      clientId: publicClientId,
    });

    expect(status).toBe(400);
    expect(body.error).toBe('access_denied');
  });

  it('should issue tokens after user approves (full flow)', async () => {
    const { body: authBody } = await nhost.auth.oauth2DeviceAuthorization({
      client_id: publicClientId,
      scope: 'openid profile email',
    });

    // User approves
    await nhost.auth.oauth2DeviceVerifyPost(
      { userCode: authBody.user_code, action: 'approve' },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    // Poll — should get tokens
    const { status, body } = await deviceTokenPoll({
      deviceCode: authBody.device_code,
      clientId: publicClientId,
    });

    expect(status).toBe(200);
    expect(body).toEqual({
      access_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: expect.any(Number),
      refresh_token: expect.any(String),
      scope: 'openid profile email',
      id_token: expect.any(String),
    });

    // Verify the access token is a valid JWT with correct claims
    const payload = jose.decodeJwt(body.access_token as string);
    expect(payload.sub).toBe(userId);

    // Verify the id_token
    const idPayload = jose.decodeJwt(body.id_token as string);
    expect(idPayload.sub).toBe(userId);
    expect(idPayload.email).toBe(DEMO_EMAIL);
  });

  it('should reject reuse of a consumed device code', async () => {
    const { body: authBody } = await nhost.auth.oauth2DeviceAuthorization({
      client_id: publicClientId,
      scope: 'openid',
    });

    await nhost.auth.oauth2DeviceVerifyPost(
      { userCode: authBody.user_code, action: 'approve' },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    // First poll — consumes the device code
    const first = await deviceTokenPoll({
      deviceCode: authBody.device_code,
      clientId: publicClientId,
    });
    expect(first.status).toBe(200);

    // Second poll — device code already consumed
    const second = await deviceTokenPoll({
      deviceCode: authBody.device_code,
      clientId: publicClientId,
    });
    expect(second.status).toBeGreaterThanOrEqual(400);
  });

  it('should issue tokens without id_token when openid scope is not requested', async () => {
    const { body: authBody } = await nhost.auth.oauth2DeviceAuthorization({
      client_id: publicClientId,
      scope: 'profile email',
    });

    await nhost.auth.oauth2DeviceVerifyPost(
      { userCode: authBody.user_code, action: 'approve' },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    const { status, body } = await deviceTokenPoll({
      deviceCode: authBody.device_code,
      clientId: publicClientId,
    });

    expect(status).toBe(200);
    expect(body.access_token).toBeString();
    expect(body.refresh_token).toBeString();
    expect(body.id_token).toBeUndefined();
  });

  it('should reject device token poll with wrong client_id', async () => {
    const { body: authBody } = await nhost.auth.oauth2DeviceAuthorization({
      client_id: publicClientId,
      scope: 'openid',
    });

    await nhost.auth.oauth2DeviceVerifyPost(
      { userCode: authBody.user_code, action: 'approve' },
      { headers: { Authorization: `Bearer ${jwt}` } },
    );

    const { status } = await deviceTokenPoll({
      deviceCode: authBody.device_code,
      clientId: 'wrong_client_id',
    });

    expect(status).toBeGreaterThanOrEqual(400);
  });

  it('should reject device token poll with missing device_code', async () => {
    try {
      await nhost.auth.oauth2Token({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: publicClientId,
      });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(FetchError);
      const fe = err as FetchError<{ error: string }>;
      expect(fe.status).toBe(400);
      expect(fe.body.error).toBe('invalid_request');
    }
  });
});
