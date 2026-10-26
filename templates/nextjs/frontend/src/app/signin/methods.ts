import type { User } from '@nhost/nhost-js/auth';
import type { ReactNode } from 'react';
import LinkedAccountsSetting from '@/app/auth/oauth/linked/LinkedAccountsSetting';
import ProviderSignIn from '@/app/auth/oauth/ProviderSignIn';
import { configuredProviders } from '@/app/auth/oauth/providers';
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
 *
 * `signedOutPaths` are the method's pages that hold a session only to finish
 * something the visitor started signed out, like setting a new password from
 * a reset link. The nav shows them as signed out there, see `NavAccount`.
 */
export type AccountSetting = (props: {
  user: User;
}) => ReactNode | Promise<ReactNode>;

export type SignInMethod = {
  href: string;
  title: string;
  description: string;
  account?: Record<string, AccountSetting>;
  signedOutPaths?: string[];
};

/**
 * A method that signs in from the sign-in list itself rather than from a page
 * of its own, because it has nothing to type first. The list shows these under
 * the links, past a divider, and passes on where the visitor was going, and
 * the href of the way they last signed in, for a button to mark as its own.
 */
export type SignInButtons = (props: {
  destination: string;
  lastUsed: string | null;
}) => ReactNode | Promise<ReactNode>;

// Only when the deployment says a provider is set up: with none, every button
// would lead to the auth service refusing it.
export const buttons: SignInButtons[] =
  configuredProviders().length > 0 ? [ProviderSignIn] : [];

/**
 * The account-page rows of the methods in `buttons`, which have no entry in
 * `methods` to carry an `account`. The account page puts them after the
 * methods' own rows.
 */
export const buttonSettings: AccountSetting[] =
  configuredProviders().length > 0 ? [LinkedAccountsSetting] : [];

export const methods: SignInMethod[] = [
  {
    href: '/auth/password',
    title: 'Email and password',
    description: 'Sign up or sign in with a password.',
    account: { password: ChangePasswordSetting, mfa: MfaSetting },
    signedOutPaths: ['/auth/password/reset'],
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
    href: '/auth/passkey',
    title: 'Passkey',
    description: 'Touch ID, Windows Hello or a security key.',
    account: { passkeys: PasskeysSetting },
  },
];
