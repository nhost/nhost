import { signInDestination } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';
import { appOrigin } from '@/lib/nhost/env';

/** The page to type the code into, as the code email links to it. */
export function codePageURL(email: string, next: string): string {
  const query = signInQuery(signInDestination(next), 'sign-in');
  const emailParam = `email=${encodeURIComponent(email)}`;

  return `${appOrigin()}/auth/otp${query ? `${query}&` : '?'}${emailParam}`;
}
