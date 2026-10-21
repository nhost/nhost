import type { User } from '@nhost/nhost-js/auth';
import type { ReactNode } from 'react';
import PasskeysSetting from '@/app/auth/passkey/manage/PasskeysSetting';
import ChangePasswordSetting from '@/app/auth/password/change/ChangePasswordSetting';
import MfaSetting from '@/app/auth/password/mfa/MfaSetting';

/**
 * The sign-in methods this app offers, one entry each.
 *
 * Every method is its own directory under `src/app/auth/`, and nothing
 * outside that directory imports from it except this file. To drop a method:
 * delete its directory, then delete its entry here and the imports it used.
 * That is the whole procedure.
 *
 * `account` is how a method puts something on the account page: the rows it
 * renders there, by name, each in the method's own directory. This file is the one
 * place shared code reaches them, so the account page renders whatever is
 * listed and names no method itself. A method with nothing to configure
 * leaves it out and the account page lists it as needing no setup.
 */
export type AccountSetting = (props: {
  user: User;
}) => ReactNode | Promise<ReactNode>;

export type SignInMethod = {
  href: string;
  title: string;
  description: string;
  account?: Record<string, AccountSetting>;
};

export const methods: SignInMethod[] = [
  {
    href: '/auth/password',
    title: 'Email and password',
    description: 'Sign up or sign in with a password.',
    account: { password: ChangePasswordSetting, mfa: MfaSetting },
  },
  {
    href: '/auth/magic-link',
    title: 'Magic link',
    description: 'Get a sign-in link by email.',
  },
  {
    href: '/auth/otp',
    title: 'Email code',
    description: 'Get a one-time code by email.',
  },
  {
    href: '/auth/oauth',
    title: 'GitHub or Google',
    description: 'Sign in with a provider account.',
  },
  {
    href: '/auth/passkey',
    title: 'Passkey',
    description: 'Use Touch ID, Windows Hello or a security key.',
    account: { passkeys: PasskeysSetting },
  },
];
