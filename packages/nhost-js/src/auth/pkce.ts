/**
 * PKCE (Proof Key for Code Exchange) utilities for RFC 7636.
 *
 * These functions use the Web Crypto API (`globalThis.crypto`), which is
 * available in all modern runtimes: browsers, Node.js >= 19, Bun, and Deno.
 */

function bufferToBase64url(buf: Uint8Array): string {
  let binary = '';
  for (const byte of buf) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a cryptographically random PKCE code verifier (43 base64url characters).
 */
export function generateCodeVerifier(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return bufferToBase64url(buf);
}

/**
 * Derive a S256 code challenge from a code verifier.
 */
export async function generateCodeChallenge(
  verifier: string,
): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return bufferToBase64url(new Uint8Array(hash));
}

/**
 * Generate a PKCE code verifier and its S256 challenge in one call.
 */
export async function generatePKCEPair(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  return { verifier, challenge };
}
