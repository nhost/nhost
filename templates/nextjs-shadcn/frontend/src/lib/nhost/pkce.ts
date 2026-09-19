import { generatePKCEPair } from '@nhost/nhost-js/auth';

/**
 * PKCE for the two flows that come back to this app through an emailed link:
 * the password reset and the email change.
 *
 * Without it the verify endpoint redirects with a refresh token in the query
 * string, and a refresh token in a query string is a session anybody can hand
 * anybody. With it the redirect carries a one-time code that is worthless
 * without the verifier this app generated and kept in an httpOnly cookie, so
 * the only browser that can spend a link is the one that asked for it.
 *
 * The price is real and worth stating: a link opened in a different browser
 * from the one that requested it cannot be redeemed. That is the same property
 * that makes the link unusable by anyone else.
 *
 * The OTP sign-in does not go through here. It never leaves the app: the code
 * is typed into the form and `verifySignInOTPEmail` answers with the session
 * directly, so there is no redirect to bind.
 */

export const PKCE_COOKIE = 'nhostPkce';
export const RECOVERY_COOKIE = 'nhostRecovery';

// What the verify endpoint appends on a PKCE redirect. `type` comes back too,
// but it is part of the URL and therefore whatever the sender made it, so
// nothing here reads it.
export const LINK_CODE_PARAM = 'code';

/**
 * Which flow a pending challenge belongs to.
 *
 * It is stored next to the verifier rather than read off the redirect, because
 * the redirect is a URL: `type` on it says only what its author typed. This
 * cookie was written by this app when it sent the email, so it is the one
 * statement of intent in the flow that an attacker cannot author.
 */
export type LinkPurpose = 'passwordReset' | 'emailChange';

export type PendingChallenge = { verifier: string; purpose: LinkPurpose };

export const linkCookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
} as const;

export type LinkCookieOptions = Omit<typeof linkCookieOptions, 'path'> & {
  path: string;
};

// The recovery cookie carries a live refresh token, so it is scoped to the one
// route that reads it. Both the reset page and the server action that redeems
// the token live at `/reset-password` (a server action POSTs to the URL of the
// page that rendered its form), so this path attaches the token to every
// request that needs it and none that do not. `path: '/'` would instead put a
// live refresh token on every request to the origin for the life of the
// cookie. `clearRecoveryToken` must delete with this same path, since a delete
// on the default path leaves a path-scoped cookie in place.
export const recoveryCookieOptions = {
  ...linkCookieOptions,
  path: '/reset-password',
} as const;

// Long enough for somebody to find the email, short enough that a forgotten
// challenge is not still spendable tomorrow.
export const PKCE_MAX_AGE = 60 * 60;

// The window between landing on the reset page and submitting the form.
export const RECOVERY_MAX_AGE = 15 * 60;

/**
 * Starts a link flow: the challenge goes in the email, the verifier stays here.
 */
export async function createChallenge(
  purpose: LinkPurpose,
): Promise<{ challenge: string; cookie: string }> {
  const { verifier, challenge } = await generatePKCEPair();

  return {
    challenge,
    cookie: JSON.stringify({ verifier, purpose } satisfies PendingChallenge),
  };
}

export function parsePendingChallenge(
  raw: string | null | undefined,
): PendingChallenge | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PendingChallenge>;
    if (
      typeof parsed.verifier !== 'string' ||
      (parsed.purpose !== 'passwordReset' && parsed.purpose !== 'emailChange')
    ) {
      return null;
    }

    return { verifier: parsed.verifier, purpose: parsed.purpose };
  } catch {
    return null;
  }
}
