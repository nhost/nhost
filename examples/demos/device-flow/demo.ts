import { createNhostClient } from '@nhost/nhost-js';
import * as jose from 'jose';

// ── Configuration ────────────────────────────────────────────────
const AUTH_URL =
  process.env.AUTH_URL ?? 'https://local.auth.local.nhost.run/v1';
const GRAPHQL_URL =
  process.env.GRAPHQL_URL ?? 'https://local.graphql.local.nhost.run/v1';

const CLIENT_ID = process.argv[2];
if (!CLIENT_ID) {
  console.log('Usage: npx tsx demo.ts <client_id>');
  console.log('');
  console.log('  Create an OAuth2 client in the Nhost Dashboard first, then');
  console.log('  pass the client ID here. The client should have the scopes:');
  console.log('  openid, profile, email, graphql');
  process.exit(1);
}

const nhost = createNhostClient({
  authUrl: AUTH_URL,
  graphqlUrl: GRAPHQL_URL,
  configure: [],
});

// ── Helpers ──────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll POST /oauth2/token with the device_code grant type.
 * Uses raw fetch because the SDK throws on non-2xx and we need to inspect
 * intermediate OAuth2 errors (authorization_pending, slow_down, etc.).
 */
async function deviceTokenPoll(params: {
  deviceCode: string;
  clientId: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const form = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: params.deviceCode,
    client_id: params.clientId,
  });

  const res = await fetch(`${AUTH_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  };
}

// ── Main ─────────────────────────────────────────────────────────
console.log('');
console.log('============================================');
console.log('  OAuth2 Device Flow Demo');
console.log('============================================');
console.log('');
console.log(`  Client ID: ${CLIENT_ID}`);
console.log('');

// Step 1: Request device authorization
console.log('Requesting device authorization...');

const { body: device } = await nhost.auth.oauth2DeviceAuthorization({
  client_id: CLIENT_ID,
  scope: 'openid profile email graphql',
});

console.log('');
console.log('============================================');
console.log('  Open this URL in your browser:');
console.log('');
console.log(`    ${device.verification_uri_complete}`);
console.log('');
console.log(`  Or go to: ${device.verification_uri}`);
console.log(`  and enter code: ${device.user_code}`);
console.log('');
console.log(`  Expires in ${device.expires_in} seconds.`);
console.log('============================================');
console.log('');

// Step 2: Poll for token
console.log('Waiting for authorization...');

let interval = device.interval * 1000;

while (true) {
  await sleep(interval);

  const { status, body } = await deviceTokenPoll({
    deviceCode: device.device_code,
    clientId: CLIENT_ID,
  });

  const error = body.error as string | undefined;

  if (error === 'authorization_pending') {
    process.stdout.write('.');
    continue;
  }

  if (error === 'slow_down') {
    interval += 5000;
    process.stdout.write('.');
    continue;
  }

  if (error === 'access_denied') {
    console.log('\n');
    console.error('ERROR: User denied the authorization request.');
    process.exit(1);
  }

  if (error === 'expired_token') {
    console.log('\n');
    console.error('ERROR: Device code expired. Please run the script again.');
    process.exit(1);
  }

  if (error) {
    console.log('\n');
    console.error(`ERROR: ${error} — ${body.error_description}`);
    process.exit(1);
  }

  if (status === 200 && body.access_token) {
    console.log('\n');
    console.log('Authorization successful!');
    console.log('');

    const accessToken = body.access_token as string;
    const refreshToken = body.refresh_token as string;
    const scope = body.scope as string;
    const expiresIn = body.expires_in as number;
    const idToken = body.id_token as string | undefined;

    // Step 3: Display token info
    console.log('── Token Details ─────────────────────────');
    console.log(`  Access Token:  ${accessToken.slice(0, 40)}...`);
    console.log(`  Refresh Token: ${refreshToken.slice(0, 20)}...`);
    console.log(`  Scope:         ${scope}`);
    console.log(`  Expires In:    ${expiresIn}s`);
    if (idToken) {
      console.log(`  ID Token:      ${idToken.slice(0, 40)}...`);
    }
    console.log('');

    // Step 4: Fetch user info via GraphQL
    // The "graphql" scope embeds Hasura-compatible claims in the access
    // token, so we can use it directly as a Bearer token against GraphQL.
    const payload = jose.decodeJwt(accessToken);
    const userId = payload.sub ?? '';

    console.log('── Fetching user info via GraphQL ────────');
    console.log(`  User ID (from JWT sub): ${userId}`);
    console.log('');

    const { body: gqlResponse } = await nhost.graphql.request<{
      user: Record<string, unknown>;
    }>(
      {
        query: `query GetUser($id: uuid!) {
          user(id: $id) {
            id
            displayName
            email
            emailVerified
            phoneNumber
            avatarUrl
            locale
            createdAt
            metadata
          }
        }`,
        variables: { id: userId },
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    console.log(
      JSON.stringify(gqlResponse.data?.user ?? gqlResponse.errors, null, 2),
    );
    console.log('');
    console.log('Done!');
    break;
  }

  console.log('\n');
  console.error('Unexpected response:', JSON.stringify(body, null, 2));
  process.exit(1);
}
