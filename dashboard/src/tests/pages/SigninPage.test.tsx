import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LAST_SIGN_IN_METHOD_STORAGE_KEY } from '@/features/auth/SignIn/utils/lastSignInMethod';
import SigninPage from '@/pages/signin';
import { render, screen } from '@/tests/testUtils';

describe('SigninPage - last sign-in method badge', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders all sign-in options without a badge when no prior sign-in exists', () => {
    render(<SigninPage />);

    expect(
      screen.getByRole('button', { name: /continue with github/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /continue with a security key/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /continue with email/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('LAST USED')).not.toBeInTheDocument();
  });

  it.each([
    ['github', /continue with github/i, 'button'],
    ['security-key', /continue with a security key/i, 'button'],
    ['email', /continue with email/i, 'link'],
  ] as const)('marks the %s option as last used', (storedMethod, accessibleName, role) => {
    window.localStorage.setItem(LAST_SIGN_IN_METHOD_STORAGE_KEY, storedMethod);
    render(<SigninPage />);

    const badge = screen.getByText('LAST USED');
    const option = screen.getByRole(role, { name: accessibleName });

    expect(badge.closest('.relative')).toContainElement(option);
    expect(screen.getByText('Last used sign-in method:')).toBeInTheDocument();
  });
});
