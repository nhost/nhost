import type { User } from '@nhost/nhost-js/auth';
import type { ReactElement } from 'react';
import { passkeyDomain } from '@/lib/nhost/env';
import PasskeysSetting from '@/screens/auth/passkey/manage/PasskeysSetting';
import ChangePasswordSetting from '@/screens/auth/password/change/ChangePasswordSetting';
import MfaSetting from '@/screens/auth/password/mfa/MfaSetting';

// Native renders no async components, so these return an element, never the
// promise React's `ReactNode` also allows.
export type AccountSetting = (props: { user: User }) => ReactElement | null;

export type SignInMethod = {
  href: string;
  title: string;
  description: string;
  account?: Record<string, AccountSetting>;
  signedOutPaths?: string[];
};

/**
 * A method that signs in from the sign-in list itself rather than from a
 * screen of its own, because it has nothing to type first.
 */
export type SignInButtons = (props: {
  destination: string;
  lastUsed: string | null;
}) => ReactElement | null;

export const buttons: SignInButtons[] = [];

/**
 * The account-screen rows of the methods in `buttons`, which have no entry in
 * `methods` to carry an `account`.
 */
export const buttonSettings: AccountSetting[] = [];

/** The sign-in methods this app offers, one entry each. */
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
  // Only once the deployment names the domain passkeys belong to: without one,
  // the device refuses to create or use any.
  ...(passkeyDomain()
    ? [
        {
          href: '/auth/passkey',
          title: 'Passkey',
          description: 'Face ID, your fingerprint or a security key.',
          account: { passkeys: PasskeysSetting },
        },
      ]
    : []),
];
