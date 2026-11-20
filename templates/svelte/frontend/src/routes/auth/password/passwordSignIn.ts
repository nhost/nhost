import { DEFAULT_DESTINATION } from '#routes/signin/destination.ts';
import { signInQuery } from '#routes/signin/query.ts';

/**
 * The password form in its sign-in mode: the mode that takes the new password,
 * and the only one that offers to send another reset link.
 */
export const passwordSignIn = `/auth/password${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;
