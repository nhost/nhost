// The browser reports a dismissed or timed-out prompt as NotAllowedError, and
// @simplewebauthn/browser keeps that name on the error it throws.
export function wasCancelled(err: unknown): boolean {
  return (err as { name?: string }).name === 'NotAllowedError';
}
