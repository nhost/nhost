import type { User } from '@nhost/nhost-js/auth';

// `[auth.totp] issuer` in nhost/nhost.toml, which auth puts in its QR code. A
// test keeps the two equal, so the app and the QR code add the same entry.
export const TOTP_ISSUER = 'Nhost + React Native';

/**
 * The `otpauth://` link auth's QR code holds, for an authenticator app on this
 * device. Auth does not send it, so it is built the way auth builds it: the
 * account named by email, else display name, else id.
 */
export function totpUri(secret: string, user: User): string {
  const account = user.email || user.displayName || user.id;
  const label = `${encodeURIComponent(TOTP_ISSUER)}:${encodeURIComponent(account)}`;
  const query = [
    `secret=${encodeURIComponent(secret)}`,
    `issuer=${encodeURIComponent(TOTP_ISSUER)}`,
    'algorithm=SHA1',
    'digits=6',
    'period=30',
  ].join('&');
  return `otpauth://totp/${label}?${query}`;
}

/** The key in groups of four, the way authenticator apps show one. */
export const groupedKey = (secret: string): string =>
  secret.match(/.{1,4}/g)?.join(' ') ?? '';
