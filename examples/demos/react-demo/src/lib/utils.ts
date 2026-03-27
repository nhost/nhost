import { generatePKCEPair } from '@nhost/nhost-js/auth';

// Format file size in a readable way
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const sizes: string[] = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i: number = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${parseFloat((bytes / 1024 ** i).toFixed(2))} ${sizes[i]}`;
}

const PKCE_VERIFIER_KEY = 'nhost_pkce_verifier';

/**
 * Generate a PKCE code verifier and S256 challenge pair.
 * The verifier is stored in localStorage so it survives across browser tabs
 * (e.g. email link opened in a new tab, or OAuth redirect).
 */
export async function generateAndStorePKCE(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const { verifier, challenge } = await generatePKCEPair();
  localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  return { verifier, challenge };
}

/**
 * Retrieve and consume the stored PKCE code verifier.
 * Returns null if no verifier is stored.
 */
export function consumePKCEVerifier(): string | null {
  const verifier = localStorage.getItem(PKCE_VERIFIER_KEY);
  if (verifier) {
    localStorage.removeItem(PKCE_VERIFIER_KEY);
  }
  return verifier;
}

/**
 * Checks if WebAuthn (FIDO2) authentication is supported in the current browser
 *
 * WebAuthn requires:
 * 1. A secure context (HTTPS or localhost)
 * 2. The PublicKeyCredential API
 * 3. The navigator.credentials API
 *
 * This function determines if the current environment can support passwordless
 * authentication using security keys or platform authenticators (e.g., Touch ID,
 * Face ID, Windows Hello, or FIDO security keys).
 *
 * Note: Even if this returns true, the user still needs to have an authenticator
 * (biometric sensor, security key) available on their device.
 *
 * @returns {boolean} Whether WebAuthn is supported in the current environment
 */
export const isWebAuthnSupported = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    !!navigator.credentials
  );
};
