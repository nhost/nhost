import type { User } from '@nhost/nhost-js/auth';
import type { ReactElement } from 'react';

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
export const methods: SignInMethod[] = [];
