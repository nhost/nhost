import {
  CryptoDigestAlgorithm,
  CryptoEncoding,
  digestStringAsync,
  getRandomBytes,
} from 'expo-crypto';

// The SDK's `generatePKCEPair` needs the Web Crypto API, which Hermes does not
// have, so the pair comes from expo-crypto instead.

const base64url = (base64: string): string =>
  base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** `count` random bytes, base64url-encoded. */
export function randomToken(count: number): string {
  return base64url(btoa(String.fromCharCode(...getRandomBytes(count))));
}

/** The S256 challenge for `verifier` (RFC 7636, section 4.2). */
export async function codeChallenge(verifier: string): Promise<string> {
  return base64url(
    await digestStringAsync(CryptoDigestAlgorithm.SHA256, verifier, {
      encoding: CryptoEncoding.BASE64,
    }),
  );
}

export type PKCEPair = { verifier: string; challenge: string };

/** A fresh verifier, 43 characters as auth requires, and its challenge. */
export async function generatePKCEPair(): Promise<PKCEPair> {
  const verifier = randomToken(32);
  return { verifier, challenge: await codeChallenge(verifier) };
}
