/**
 * Whether unlinking one provider still leaves a way in: an email address,
 * which the email methods sign in with, or another linked provider. A passkey
 * needs an address to sign up with, so an account with a passkey has one.
 */
export function leavesAWayIn(
  email: string | undefined,
  links: number,
): boolean {
  return Boolean(email) || links > 1;
}
