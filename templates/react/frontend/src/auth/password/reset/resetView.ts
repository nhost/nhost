export type ResetView = 'form' | 'waiting' | 'changed' | 'link-failed';

/**
 * Which card the reset page shows.
 *
 * A password change revokes every session the account has, so whoever held the
 * old password or a stolen refresh token is cut off, and the SDK clears this
 * one too. It does that as soon as the server accepts the change, while the
 * call is still returning. So a change that worked is checked before the
 * session, which by then is gone, and while the call is out a missing session
 * shows nothing rather than reading as a dead link.
 */
export function resetView({
  changed,
  pending,
  signedIn,
  linkFailed,
}: {
  changed: boolean;
  pending: boolean;
  signedIn: boolean;
  linkFailed: boolean;
}): ResetView {
  if (changed) {
    return 'changed';
  }

  if (pending && !signedIn) {
    return 'waiting';
  }

  if (linkFailed || !signedIn) {
    return 'link-failed';
  }

  return 'form';
}
