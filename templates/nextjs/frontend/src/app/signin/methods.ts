import type { User } from '@nhost/nhost-js/auth';
import type { ReactNode } from 'react';
import LinkedAccountsSetting from '@/app/auth/oauth/linked/LinkedAccountsSetting';
import ProviderSignIn from '@/app/auth/oauth/ProviderSignIn';
import { configuredProviders } from '@/app/auth/oauth/providers';
import PasskeysSetting from '@/app/auth/passkey/manage/PasskeysSetting';
import ChangePasswordSetting from '@/app/auth/password/change/ChangePasswordSetting';
import MfaSetting from '@/app/auth/password/mfa/MfaSetting';

/** The sign-in methods this app offers, one entry each. */
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
 * of its own, because it has nothing to type first.
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
 * `methods` to carry an `account`.
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
