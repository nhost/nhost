// End-to-end integration tests for the generic OIDC provider against a real
// Dex identity provider (see build/dev/docker/docker-compose.yaml and
// build/dev/docker/oidc/). These exercise the browser authorization-code flow
// that the isolated Go unit tests can only simulate: a genuine IdP login, PKCE
// to the IdP, the Nhost authorization-code exchange, identity persistence, and
// the security boundaries (issuer binding, no silent same-email merge, no
// session on rejected responses).
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Client } from 'pg';

import { ENV } from '../../src/env';
import {
  AUTH_OIDC_BASE_URL,
  CLIENT_URL,
  DEX_ISSUER,
  completeCallback,
  driveDexLogin,
  exchangeCode,
  generatePKCE,
  getEmailPasswordSession,
  oidcFetch,
  signInWithDex,
  startBrowserFlow,
  waitForStack,
} from './dex-flow';

const PASSWORD = 'Password123!';
const ALICE = { login: 'alice@oidc.local', password: PASSWORD };
const BOB = { login: 'bob@oidc.local', password: PASSWORD };
const CAROL = { login: 'carol@oidc.local', password: PASSWORD };
const LINK_BASE_EMAIL = 'oidc-link-base@example.com';

// Every email this suite can create, so a repeated run starts from a clean slate.
const MANAGED_EMAILS = [
  ALICE.login,
  BOB.login,
  CAROL.login,
  LINK_BASE_EMAIL,
];

const oidcIdentities = async (client: Client, userId: string) =>
  client.query(
    `SELECT provider_id, provider_user_id, issuer FROM auth.user_providers
     WHERE user_id = $1 AND provider_id LIKE 'oidc:%'`,
    [userId],
  );

describe('oidc/dex browser flow', () => {
  let client: Client;
  let aliceUserId: string;

  beforeAll(async () => {
    await waitForStack();

    client = new Client({ connectionString: ENV.HASURA_GRAPHQL_DATABASE_URL });
    await client.connect();
    // Deleting the users cascades to their identities and refresh tokens.
    await client.query(`DELETE FROM auth.users WHERE email = ANY($1)`, [
      MANAGED_EMAILS,
    ]);
  });

  afterAll(async () => {
    await client.query(`DELETE FROM auth.users WHERE email = ANY($1)`, [
      MANAGED_EMAILS,
    ]);
    await client.end();
  });

  it('signs in through Dex with PKCE and issues an Nhost session', async () => {
    const { session, authorizeUrl } = await signInWithDex('dex', ALICE, {
      state: 'app-state-1',
    });

    // Upstream PKCE and nonce are presented to the IdP.
    const authorize = new URL(authorizeUrl);
    expect(authorize.origin).toBe(new URL(DEX_ISSUER).origin);
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorize.searchParams.get('code_challenge')).toBeTruthy();
    expect(authorize.searchParams.get('nonce')).toBeTruthy();
    // The client secret must never appear in the browser-visible authorize URL.
    expect(authorizeUrl).not.toContain('test-secret');

    // A real Nhost session is issued for the IdP user.
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();
    expect(session.user.email).toBe(ALICE.login);

    // The access token subject is the persisted Nhost user.
    const payload = JSON.parse(
      Buffer.from(session.accessToken.split('.')[1], 'base64url').toString(),
    );
    expect(payload.sub).toBe(session.user.id);

    aliceUserId = session.user.id;

    // The identity is persisted and bound to the real Dex issuer.
    const { rows } = await oidcIdentities(client, aliceUserId);
    expect(rows).toHaveLength(1);
    expect(rows[0].provider_id).toBe('oidc:dex');
    expect(rows[0].issuer).toBe(DEX_ISSUER);
    // provider_user_id is the issuer-bound SHA-256 identity key, not the raw sub.
    expect(rows[0].provider_user_id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('resolves the same Nhost user on a repeat sign-in', async () => {
    const { session } = await signInWithDex('dex', ALICE);
    expect(session.user.id).toBe(aliceUserId);

    const users = await client.query(
      `SELECT id FROM auth.users WHERE email = $1`,
      [ALICE.login],
    );
    expect(users.rows).toHaveLength(1);

    const { rows } = await oidcIdentities(client, aliceUserId);
    expect(rows).toHaveLength(1);
  });

  it('enforces PKCE on the Nhost code exchange and single use', async () => {
    const pkce = generatePKCE();
    const { authorizeUrl, cookie } = await startBrowserFlow('/signin/oidc/dex', {
      codeChallenge: pkce.challenge,
    });
    const callbackUrl = await driveDexLogin(authorizeUrl, ALICE);
    const callback = await completeCallback(callbackUrl, cookie);
    const code = callback.params?.get('code');
    expect(code).toBeTruthy();

    // Wrong verifier is rejected, leaving the code usable.
    const wrong = await exchangeCode(code!, generatePKCE().verifier);
    expect(wrong.status).toBe(400);
    expect(wrong.session).toBeNull();

    // Correct verifier yields the same user.
    const right = await exchangeCode(code!, pkce.verifier);
    expect(right.status).toBe(200);
    expect(right.session?.user.id).toBe(aliceUserId);

    // The authorization code cannot be replayed.
    const replay = await exchangeCode(code!, pkce.verifier);
    expect(replay.status).toBe(400);
    expect(replay.session).toBeNull();
  });

  it('links a new Dex identity to an existing Nhost user', async () => {
    const base = await getEmailPasswordSession(LINK_BASE_EMAIL, PASSWORD);

    const { authorizeUrl, cookie } = await startBrowserFlow('/signin/oidc/dex', {
      connect: base.accessToken,
    });
    const callbackUrl = await driveDexLogin(authorizeUrl, BOB);
    const callback = await completeCallback(callbackUrl, cookie);

    // Linking redirects back to the client without issuing a session.
    expect(callback.status).toBe(302);
    expect(callback.location?.startsWith(CLIENT_URL)).toBe(true);
    expect(callback.params?.get('code')).toBeNull();
    expect(callback.params?.get('error')).toBeNull();

    // The Bob identity is attached to the existing user, bound to the issuer.
    const { rows } = await oidcIdentities(client, base.user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].issuer).toBe(DEX_ISSUER);

    // No standalone user was created for the IdP email.
    const bob = await client.query(
      `SELECT id FROM auth.users WHERE email = $1`,
      [BOB.login],
    );
    expect(bob.rows).toHaveLength(0);
  });

  it('does not silently merge a Dex identity into a same-email account', async () => {
    // An email/password account already owns carol@oidc.local.
    const existing = await getEmailPasswordSession(CAROL.login, PASSWORD);

    const pkce = generatePKCE();
    const { authorizeUrl, cookie } = await startBrowserFlow('/signin/oidc/dex', {
      codeChallenge: pkce.challenge,
    });
    const callbackUrl = await driveDexLogin(authorizeUrl, CAROL);
    const callback = await completeCallback(callbackUrl, cookie);

    // The flow is rejected: an error redirect, never an Nhost session code.
    expect(callback.status).toBe(302);
    expect(callback.location?.startsWith(CLIENT_URL)).toBe(true);
    expect(callback.params?.get('error')).toBeTruthy();
    expect(callback.params?.get('code')).toBeNull();

    // The pre-existing account is untouched and gained no OIDC identity.
    const users = await client.query(
      `SELECT id FROM auth.users WHERE email = $1`,
      [CAROL.login],
    );
    expect(users.rows).toHaveLength(1);
    expect(users.rows[0].id).toBe(existing.user.id);

    const { rows } = await oidcIdentities(client, existing.user.id);
    expect(rows).toHaveLength(0);
  });

  it('rejects a tampered state at the callback with no session', async () => {
    const pkce = generatePKCE();
    const { authorizeUrl, cookie } = await startBrowserFlow('/signin/oidc/dex', {
      codeChallenge: pkce.challenge,
    });
    const callbackUrl = await driveDexLogin(authorizeUrl, ALICE);

    const tampered = new URL(callbackUrl);
    tampered.searchParams.set('state', 'not-a-valid-signed-state');
    const res = await oidcFetch(tampered, { headers: { Cookie: cookie } });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid-state');
  });

  it('rejects an issuer-mismatched provider before contacting the IdP', async () => {
    const pkce = generatePKCE();
    const url = new URL('/signin/oidc/dexwrongissuer', AUTH_OIDC_BASE_URL);
    url.searchParams.set('codeChallenge', pkce.challenge);

    const res = await oidcFetch(url);
    // Discovery sees a different issuer than configured, so no flow can start.
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('oauth-provider-error');
  });

  it('redirects unknown providers to the disabled-endpoint error', async () => {
    const pkce = generatePKCE();
    const url = new URL('/signin/oidc/doesnotexist', AUTH_OIDC_BASE_URL);
    url.searchParams.set('codeChallenge', pkce.challenge);

    const res = await oidcFetch(url);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=disabled-endpoint');
  });
});
