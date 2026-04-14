import { generatePKCEPair } from '@nhost/nhost-js/auth';

const PKCE_VERIFIER_PREFIX = 'nhost_pkce_verifier:';

/**
 * Generate a PKCE code verifier and S256 challenge pair.
 * The verifier is stored in localStorage keyed by a unique ID so that
 * concurrent auth flows (e.g. multiple tabs) don't clobber each other.
 * The ID must be round-tripped through the redirect URL so the callback
 * can look up the correct verifier.
 */
export async function generateAndStorePKCE(): Promise<{
  verifier: string;
  challenge: string;
  id: string;
}> {
  const id = crypto.randomUUID();
  const { verifier, challenge } = await generatePKCEPair();
  localStorage.setItem(`${PKCE_VERIFIER_PREFIX}${id}`, verifier);
  return { verifier, challenge, id };
}

/**
 * Retrieve and consume the stored PKCE code verifier for the given ID.
 * Returns null if no verifier is stored.
 */
export function consumePKCEVerifier(id: string): string | null {
  const key = `${PKCE_VERIFIER_PREFIX}${id}`;
  const verifier = localStorage.getItem(key);
  if (verifier) {
    localStorage.removeItem(key);
  }
  return verifier;
}

/**
 * Append the PKCE ID as a `pkceId` query parameter to a redirect URL.
 */
export function appendPkceId(url: string, id: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('pkceId', id);
  return parsed.toString();
}
