/**
 * Whether unlinking one provider still leaves a way in: an email address, which
 * the email methods sign in with, or another linked provider.
 */
export function leavesAWayIn(
  email: string | undefined,
  links: number,
): boolean {
  return Boolean(email) || links > 1;
}
