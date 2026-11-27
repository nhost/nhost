import { signInDestination } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';
import { appOrigin } from '@/lib/nhost/env';

/** The code page for this address, sent as the code request's `redirectTo`. */
export function codePageURL(email: string, next: string): string {
  const query = signInQuery(signInDestination(next), 'sign-in');
  const emailParam = `email=${encodeURIComponent(email)}`;

  return `${appOrigin()}/auth/otp${query ? `${query}&` : '?'}${emailParam}`;
}
