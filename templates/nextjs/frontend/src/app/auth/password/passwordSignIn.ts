import { DEFAULT_DESTINATION } from '@/app/signin/destination';
import { signInQuery } from '@/app/signin/query';

/**
 * The password form in its sign-in mode: the mode that takes the new password,
 * and the only one that offers to send another reset link.
 */
export const passwordSignIn = `/auth/password${signInQuery(DEFAULT_DESTINATION, 'sign-in')}`;
