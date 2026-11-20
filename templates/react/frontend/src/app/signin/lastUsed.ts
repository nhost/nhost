// How the visitor last signed in on this browser, so the sign-in list can point
// it out.
const LAST_USED_KEY = 'nhostLastSignIn';
const LAST_USED_MAX_AGE = 60 * 60 * 24 * 365;

// How the visitor is signing in right now.
const ATTEMPT_KEY = 'nhostSignInAttempt';
const ATTEMPT_MAX_AGE = 60 * 60 * 24;

type Stored = { href: string; expires: number };

// `localStorage` keeps entries forever, so each one carries its own expiry.
function write(key: string, href: string, maxAgeSeconds: number): void {
  const value: Stored = { href, expires: Date.now() + maxAgeSeconds * 1000 };
  window.localStorage.setItem(key, JSON.stringify(value));
}

function read(key: string): string | null {
  const raw = window.localStorage.getItem(key);
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
  window.localStorage.removeItem(key);
  return null;
}

/** Notes that a signed-out visitor started signing in the way `href` names. */
export function recordSignInAttempt(href: string): void {
  write(ATTEMPT_KEY, href, ATTEMPT_MAX_AGE);
}

/** Keeps the attempt as the way the visitor last signed in. */
export function promoteSignInAttempt(): void {
  const attempt = read(ATTEMPT_KEY);
  if (attempt) {
    write(LAST_USED_KEY, attempt, LAST_USED_MAX_AGE);
    window.localStorage.removeItem(ATTEMPT_KEY);
  }
}

/** The href of the way the visitor last signed in, if they have. */
export function lastUsedSignIn(): string | null {
  return read(LAST_USED_KEY);
}
