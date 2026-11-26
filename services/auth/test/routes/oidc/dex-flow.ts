// End-to-end driver for the browser OpenID Connect authorization-code flow
// against a real Dex identity provider. Everything here runs over HTTPS against
// the isolated OIDC stack defined in build/dev/docker/docker-compose.yaml:
//
//   - Dex (the IdP)            https://10.233.0.10:5556/dex
//   - Auth (HTTPS front)       https://10.233.0.11
//
// The static IPs are baked into the issuer and redirect URI so the same URLs
// resolve from the Auth container (Docker network) and from this test runner
// (Linux routes the bridge subnet). TLS is verified against the committed test
// CA; no certificate verification is disabled.
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';

// Trust the committed test CA for every request in this flow. The path is
// resolved from the working directory (services/auth locally, the copied tree
// in the nix check); override with OIDC_CA_CERT_PATH if needed.
const CA_PATH =
  process.env['OIDC_CA_CERT_PATH'] ??
  'build/dev/docker/oidc/certs/ca.crt';
const CA_CERT = readFileSync(CA_PATH, 'utf-8');

export const AUTH_OIDC_BASE_URL =
  process.env['AUTH_OIDC_BASE_URL'] ?? 'https://10.233.0.11';
export const DEX_ISSUER =
  process.env['OIDC_DEX_ISSUER'] ?? 'https://10.233.0.10:5556/dex';
export const CLIENT_URL = 'http://localhost:3000';

const AUTH_ORIGIN = new URL(AUTH_OIDC_BASE_URL).origin;

export interface OidcFetchInit extends RequestInit {
  redirect?: RequestRedirect;
}

// Bun's fetch accepts a `tls` option to supply a custom CA. Verification stays
// on; only the trust anchor is the test CA.
export const oidcFetch = (
  url: string | URL,
  init: OidcFetchInit = {},
): Promise<Response> =>
  fetch(url, {
    redirect: 'manual',
    ...init,
    tls: { ca: CA_CERT },
  } as RequestInit);

export interface Pkce {
  verifier: string;
  challenge: string;
}

export const generatePKCE = (): Pkce => {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
};

const setCookies = (res: Response): string[] => {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
};

const storeCookies = (jar: Map<string, string>, res: Response): void => {
  for (const cookie of setCookies(res)) {
    const [pair] = cookie.split(';');
    const index = pair.indexOf('=');
    if (index > 0) {
      jar.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }
};

const cookieHeader = (jar: Map<string, string>): string =>
  Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');

interface LoginForm {
  action: string;
  hidden: Record<string, string>;
}

// Dex's local-connector login page posts `login` and `password`. The request
// identifier travels in the form action query, so hidden inputs are rarely
// present, but we forward any we find to stay robust across Dex versions.
const parseLoginForm = (html: string, currentUrl: string): LoginForm | null => {
  if (!/name="login"/.test(html) || !/name="password"/.test(html)) {
    return null;
  }
  const formMatch = html.match(/<form[^>]*\baction="([^"]*)"[^>]*>([\s\S]*?)<\/form>/i);
  if (!formMatch) {
    return null;
  }
  const action = new URL(decodeHtml(formMatch[1]), currentUrl).toString();
  const hidden: Record<string, string> = {};
  const inputs = formMatch[2].matchAll(/<input[^>]*>/gi);
  for (const [tag] of inputs) {
    if (!/type="hidden"/i.test(tag)) continue;
    const name = tag.match(/\bname="([^"]*)"/i)?.[1];
    const value = tag.match(/\bvalue="([^"]*)"/i)?.[1] ?? '';
    if (name) hidden[name] = decodeHtml(value);
  }
  return { action, hidden };
};

const decodeHtml = (value: string): string =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&#34;/g, '"')
    .replace(/&quot;/g, '"')
    .replace(/&#61;/g, '=');

export interface DexCredentials {
  login: string;
  password: string;
}

/**
 * Follow the Dex side of the flow: starting from the authorization URL, follow
 * redirects on the Dex origin, submit the login form, and return the Auth
 * callback URL (code + state) once Dex redirects back to the Auth host.
 */
export const driveDexLogin = async (
  authorizeUrl: string,
  credentials: DexCredentials,
): Promise<string> => {
  const jar = new Map<string, string>();
  let url = authorizeUrl;
  let method = 'GET';
  let body: URLSearchParams | undefined;

  for (let step = 0; step < 12; step++) {
    const res = await oidcFetch(url, {
      method,
      body,
      headers: {
        ...(jar.size ? { Cookie: cookieHeader(jar) } : {}),
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
    });
    storeCookies(jar, res);

    const location = res.headers.get('location');
    if (location) {
      const next = new URL(location, url);
      if (next.origin === AUTH_ORIGIN) {
        return next.toString();
      }
      url = next.toString();
      method = 'GET';
      body = undefined;
      continue;
    }

    if (res.status !== 200) {
      throw new Error(
        `Unexpected Dex response ${res.status} at ${url}: ${await res.text()}`,
      );
    }

    const form = parseLoginForm(await res.text(), url);
    if (!form) {
      throw new Error(`No Dex login form found at ${url}`);
    }
    url = form.action;
    method = 'POST';
    body = new URLSearchParams({
      ...form.hidden,
      login: credentials.login,
      password: credentials.password,
    });
  }

  throw new Error('Dex login did not redirect back to Auth');
};

export interface StartResult {
  authorizeUrl: string;
  cookie: string; // "__Host-nhost-oidc-<nonce>=<verifier>"
}

/** Begin a sign-in or signup browser flow and capture the host-bound cookie. */
export const startBrowserFlow = async (
  path: string,
  query: Record<string, string>,
): Promise<StartResult> => {
  const url = new URL(path, AUTH_OIDC_BASE_URL);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const res = await oidcFetch(url);
  if (res.status !== 302) {
    throw new Error(
      `Expected an authorization redirect, got ${res.status}: ${await res.text()}`,
    );
  }

  const authorizeUrl = res.headers.get('location');
  if (!authorizeUrl) {
    throw new Error('Authorization redirect is missing a Location header');
  }

  const cookie = setCookies(res)
    .map((value) => value.split(';')[0])
    .find((pair) => pair.startsWith('__Host-nhost-oidc-'));
  if (!cookie) {
    throw new Error('Start response did not set the host-bound OIDC cookie');
  }

  return { authorizeUrl, cookie };
};

export interface CallbackResult {
  status: number;
  location: string | null;
  params: URLSearchParams | null;
}

/** Complete the Auth callback with the host-bound cookie. */
export const completeCallback = async (
  callbackUrl: string,
  cookie: string,
): Promise<CallbackResult> => {
  const res = await oidcFetch(callbackUrl, { headers: { Cookie: cookie } });
  const location = res.headers.get('location');
  return {
    status: res.status,
    location,
    params: location ? new URL(location).searchParams : null,
  };
};

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
}

/** Exchange an Nhost authorization code for a session on the HTTPS instance. */
export const exchangeCode = async (
  code: string,
  codeVerifier: string,
): Promise<{ status: number; session: Session | null }> => {
  const res = await oidcFetch(new URL('/token/exchange', AUTH_OIDC_BASE_URL), {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier }),
  });
  const status = res.status;
  if (status !== 200) {
    return { status, session: null };
  }
  const payload = (await res.json()) as { session: Session };
  return { status, session: payload.session };
};

const postJson = (path: string, body: unknown): Promise<Response> =>
  oidcFetch(new URL(path, AUTH_OIDC_BASE_URL), {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/**
 * Ensure an email/password user exists on the HTTPS instance and return a fresh
 * session for it. Signup is best-effort (a repeated run returns 409); the
 * session always comes from an explicit sign-in.
 */
export const getEmailPasswordSession = async (
  email: string,
  password: string,
): Promise<Session> => {
  const signup = await postJson('/signup/email-password', { email, password });
  if (signup.status !== 200 && signup.status !== 409) {
    throw new Error(
      `email/password signup failed (${signup.status}): ${await signup.text()}`,
    );
  }

  const signin = await postJson('/signin/email-password', { email, password });
  if (signin.status !== 200) {
    throw new Error(
      `email/password signin failed (${signin.status}): ${await signin.text()}`,
    );
  }
  const payload = (await signin.json()) as { session: Session };
  return payload.session;
};

/**
 * Run the full sign-in/signup browser flow for a Dex user and return the
 * resulting Nhost session plus the authorization URL (for PKCE assertions).
 */
export const signInWithDex = async (
  slug: string,
  credentials: DexCredentials,
  options: { flow?: 'signin' | 'signup'; state?: string } = {},
): Promise<{ session: Session; authorizeUrl: string; callback: CallbackResult }> => {
  const pkce = generatePKCE();
  const query: Record<string, string> = { codeChallenge: pkce.challenge };
  if (options.state) query['state'] = options.state;

  const flow = options.flow ?? 'signin';
  const { authorizeUrl, cookie } = await startBrowserFlow(
    `/${flow}/oidc/${slug}`,
    query,
  );

  const callbackUrl = await driveDexLogin(authorizeUrl, credentials);
  const callback = await completeCallback(callbackUrl, cookie);
  if (callback.status !== 302 || !callback.params?.get('code')) {
    throw new Error(
      `Callback did not return an Nhost code (status ${callback.status}, location ${callback.location})`,
    );
  }

  const { status, session } = await exchangeCode(
    callback.params.get('code')!,
    pkce.verifier,
  );
  if (status !== 200 || !session) {
    throw new Error(`Token exchange failed with status ${status}`);
  }

  return { session, authorizeUrl, callback };
};

/** Poll Dex discovery and the Auth health endpoint until both are reachable. */
export const waitForStack = async (timeoutMs = 90_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  const checks: [string, URL][] = [
    ['Dex discovery', new URL(`${DEX_ISSUER}/.well-known/openid-configuration`)],
    ['Auth health', new URL('/healthz', AUTH_OIDC_BASE_URL)],
  ];

  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const results = await Promise.all(
        checks.map(async ([, url]) => (await oidcFetch(url)).status),
      );
      if (results.every((status) => status === 200)) {
        return;
      }
      lastError = `statuses ${results.join(', ')}`;
    } catch (err) {
      lastError = String(err);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`OIDC stack not ready within ${timeoutMs}ms: ${lastError}`);
};
