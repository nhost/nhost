import type { User } from '@nhost/nhost-js/auth';
import type { Component } from 'vue';

/** An account-page row, given the signed-in `user` as a prop. */
export type AccountSetting = Component<{ user: User }>;

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
export type SignInButtons = Component<{
  destination: string;
  lastUsed: string | null;
}>;

export const buttons: SignInButtons[] = [];

/**
 * The account-page rows of the methods in `buttons`, which have no entry in
 * `methods` to carry an `account`.
 */
export const buttonSettings: AccountSetting[] = [];

/** The sign-in methods this app offers, one entry each. */
export const methods: SignInMethod[] = [];
