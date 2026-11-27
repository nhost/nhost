import {
  clearDeviceItem,
  type DeviceKey,
  getDeviceItem,
  setDeviceItem,
} from '@/lib/deviceStore';

// How the user last signed in on this device, so the sign-in list can point it
// out.
const LAST_USED_KEY = 'nhostLastSignIn';
const LAST_USED_MAX_AGE = 60 * 60 * 24 * 365;

// How the user is signing in right now.
const ATTEMPT_KEY = 'nhostSignInAttempt';
const ATTEMPT_MAX_AGE = 60 * 60 * 24;

type Stored = { href: string; expires: number };

// SecureStore keeps entries until they are cleared, so each one carries its
// own expiry.
function write(key: DeviceKey, href: string, maxAgeSeconds: number): void {
  const value: Stored = { href, expires: Date.now() + maxAgeSeconds * 1000 };
  setDeviceItem(key, JSON.stringify(value));
}

function read(key: DeviceKey): string | null {
  const raw = getDeviceItem(key);
  if (raw === null) {
    return null;
  }

  try {
    const { href, expires } = JSON.parse(raw) as Stored;
    if (typeof href === 'string' && expires > Date.now()) {
      return href;
    }
  } catch {
    // Unreadable is the same as expired.
  }
  clearDeviceItem(key);
  return null;
}

/** Notes that a signed-out user started signing in the way `href` names. */
export function recordSignInAttempt(href: string): void {
  write(ATTEMPT_KEY, href, ATTEMPT_MAX_AGE);
}

/** Keeps the attempt as the way the user last signed in. */
export function promoteSignInAttempt(): void {
  const attempt = read(ATTEMPT_KEY);
  if (attempt) {
    write(LAST_USED_KEY, attempt, LAST_USED_MAX_AGE);
    clearDeviceItem(ATTEMPT_KEY);
  }
}

/** The href of the way the user last signed in, if they have. */
export function lastUsedSignIn(): string | null {
  return read(LAST_USED_KEY);
}
