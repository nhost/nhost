/// <reference types="vitest/globals" />

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LAST_SIGN_IN_METHOD_STORAGE_KEY } from '@/features/auth/SignIn/utils/lastSignInMethod';
import type { AuthContextType } from '@/providers/Auth';
import { render, screen } from '@/tests/testUtils';
import SigninPage from './signin';

vi.mock('@/providers/Auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/providers/Auth')>();
  return {
    ...actual,
    useAuth: (): AuthContextType => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      isSigningOut: false,
      signout: vi.fn(),
      updateSession: vi.fn(),
      clearIsSigningOut: vi.fn(),
    }),
  };
});

vi.mock('@/features/auth/SignIn/SignInWithGithub', () => ({
  SignInWithGithub: () => <button type="button">Continue with GitHub</button>,
}));

vi.mock('@/features/auth/SignIn/SecurityKey', () => ({
  SignInWithSecurityKey: () => (
    <button type="button">Continue with a security key</button>
  ),
}));

describe('SigninPage - Last Sign-In Method Badge', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders all sign-in options without a LAST USED badge when no prior sign-in exists', () => {
    render(<SigninPage />);

    expect(screen.getByText('Continue with GitHub')).toBeInTheDocument();
    expect(
      screen.getByText('Continue with a security key'),
    ).toBeInTheDocument();
    expect(screen.getByText('Continue with Email')).toBeInTheDocument();
    expect(screen.queryByText('LAST USED')).not.toBeInTheDocument();
  });

  it('renders the LAST USED badge over GitHub button when lastSignInMethod is github', () => {
    window.localStorage.setItem(LAST_SIGN_IN_METHOD_STORAGE_KEY, 'github');
    render(<SigninPage />);

    const badge = screen.getByText('LAST USED');
    expect(badge).toBeInTheDocument();

    const githubButton = screen.getByText('Continue with GitHub');
    const badgeContainer = badge.closest('.relative');
    expect(badgeContainer).toContainElement(githubButton);
  });

  it('renders the LAST USED badge over Security Key button when lastSignInMethod is security-key', () => {
    window.localStorage.setItem(
      LAST_SIGN_IN_METHOD_STORAGE_KEY,
      'security-key',
    );
    render(<SigninPage />);

    const badge = screen.getByText('LAST USED');
    expect(badge).toBeInTheDocument();

    const securityKeyButton = screen.getByText('Continue with a security key');
    const badgeContainer = badge.closest('.relative');
    expect(badgeContainer).toContainElement(securityKeyButton);
  });

  it('renders the LAST USED badge over Email button when lastSignInMethod is email', () => {
    window.localStorage.setItem(LAST_SIGN_IN_METHOD_STORAGE_KEY, 'email');
    render(<SigninPage />);

    const badge = screen.getByText('LAST USED');
    expect(badge).toBeInTheDocument();

    const emailLink = screen.getByText('Continue with Email');
    const badgeContainer = badge.closest('.relative');
    expect(badgeContainer).toContainElement(emailLink);
  });
});
