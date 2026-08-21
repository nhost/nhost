/**
 * Rejects redirect targets that would leave the app, so a crafted
 * `/signin?redirect=...` link cannot bounce a user to another origin.
 */
export function isSafeInternalRedirect(target: string): boolean {
  return (
    target.startsWith('/') &&
    !target.startsWith('//') &&
    !target.startsWith('/\\')
  );
}
