import { signInDestination } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';
import { appOrigin } from '@/lib/nhost/env';

/**
 * The page to type the code into, as the code email links to it.
 *
 * The auth service puts `redirectTo` in the email, and a mail client turns a
 * URL there into a link whether the template made it one or not. Left at the
 * bare origin, that link opened the home page with nowhere to type the code.
 * This one opens the code step for the same address (`?email=`, read by the
 * page), and goes on to `next` like the form the code was sent from.
 *
 * `next` is checked again because it comes from a server action's arguments,
 * which anyone can call with anything, and it is appended to the origin.
 */
export function codePageURL(email: string, next: string): string {
  const query = signInQuery(signInDestination(next), 'sign-in');
  const emailParam = `email=${encodeURIComponent(email)}`;

  return `${appOrigin()}/auth/otp${query ? `${query}&` : '?'}${emailParam}`;
}
