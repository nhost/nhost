import { appOrigin } from '#lib/nhost/env.server.ts';
import { signInDestination } from '#routes/signin/destination.ts';
import { signInQuery } from '#routes/signin/query.ts';

/** The code page for this address, sent as the code request's `redirectTo`. */
export function codePageURL(email: string, next: string): string {
  const query = signInQuery(signInDestination(next), 'sign-in');
  const emailParam = `email=${encodeURIComponent(email)}`;

  return `${appOrigin()}/auth/otp${query ? `${query}&` : '?'}${emailParam}`;
}
