/// <reference types="vitest/globals" />
import { createServerClient } from '@nhost/nhost-js';
import type React from 'react';
import { useContext } from 'react';

import * as gitUtils from '@/features/orgs/projects/git/common/utils';
import { AuthContext } from '@/providers/Auth/AuthContext';
import AuthProvider from '@/providers/Auth/AuthProvider';
import { NhostProvider } from '@/providers/nhost';
import { mockMatchMediaValue, mockRouter, mockSession } from '@/tests/mocks';
import { render, screen, waitFor } from '@/tests/testUtils';
import { DummySessionStorage } from '@/utils/nhost';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(mockMatchMediaValue),
});

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
  // The default export is used by useRemoveQueryParamsFromUrl.
  default: { push: vi.fn(), query: {}, pathname: '/' },
}));

// Create a component that consumes the AuthContext to trigger and test state changes
const ContextConsumer = () => {
  const ctx = useContext(AuthContext);

  return (
    <div>
      <span data-testid="is-authenticated">
        {ctx?.isAuthenticated ? 'true' : 'false'}
      </span>
      <span data-testid="is-signing-out">
        {ctx?.isSigningOut ? 'true' : 'false'}
      </span>
      <button
        type="button"
        onClick={() => ctx?.signout()}
        data-testid="signout-btn"
      >
        Sign Out
      </button>
      <button
        type="button"
        onClick={() => ctx?.updateSession(mockSession)}
        data-testid="update-btn"
      >
        Update Session
      </button>
      <button
        type="button"
        onClick={() => ctx?.clearIsSigningOut()}
        data-testid="clear-signout-btn"
      >
        Clear Signout
      </button>
    </div>
  );
};

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useRouter.mockReturnValue(mockRouter);

    vi.spyOn(gitUtils, 'clearGitHubToken');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization Error Handling', () => {
    it('redirects to /email/verify when error is unverified-user', async () => {
      mocks.useRouter.mockReturnValue({
        ...mockRouter,
        query: { error: 'unverified-user' },
      });

      render(<div>Child</div>);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/email/verify');
      });
    });

    it('redirects to github-modal when error is invalid-state and provider_state matches install-github-app', async () => {
      const query = {
        error: 'invalid-state',
        provider_state: 'install-github-app:my-org:my-proj',
      };

      mocks.useRouter.mockReturnValue({ ...mockRouter, query });

      render(<div>Child</div>);

      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(
          '/orgs/my-org/projects/my-proj/settings/deployments?github-modal',
        );
      });
    });

    it('shows toast and redirects to /signin for generic invalid-state fallback', async () => {
      const query = {
        error: 'invalid-state',
        provider_state: 'some-other-state',
      };

      mocks.useRouter.mockReturnValue({ ...mockRouter, query });

      render(<div>Child</div>);

      expect(
        await screen.findByText(
          'An error occurred during the sign-in process. Please try again.',
        ),
      ).toBeInTheDocument();
      expect(mockRouter.push).toHaveBeenCalledWith('/signin');
    });

    it('shows toast with errorDescription and redirects to /signin for unknown errors', async () => {
      const query = {
        error: 'server_error',
        errorDescription: 'Custom error message from server',
      };

      mocks.useRouter.mockReturnValue({ ...mockRouter, query });

      render(<div>Child</div>);

      expect(
        await screen.findByText('Custom error message from server'),
      ).toBeInTheDocument();
      expect(mockRouter.push).toHaveBeenCalledWith('/signin');
    });
  });

  describe('Re-render Edge Cases', () => {
    it('ignores query param changes after initial mount due to intentional dependency array', async () => {
      const { rerender } = render(<ContextConsumer />);

      // Wait for the initial mount effect to finish before changing the query.
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      // Simulate a route change that adds an error query param.
      mocks.useRouter.mockReturnValue({
        ...mockRouter,
        query: { error: 'unverified-user' },
      });

      rerender(<ContextConsumer />);

      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe('AuthContext Methods', () => {
    it('signout updates state, calls nhost.auth.signOut and redirects', async () => {
      render(<ContextConsumer />);

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      screen.getByTestId('signout-btn').click();

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe(
          'false',
        );
        expect(screen.getByTestId('is-signing-out').textContent).toBe('true');
        expect(gitUtils.clearGitHubToken).toHaveBeenCalled();
        expect(mockRouter.push).toHaveBeenCalledWith('/signin');
      });
    });

    it('updateSession correctly updates the context session', async () => {
      // Create wrapper with no session initially
      const EmptySessionWrapper = ({
        children,
      }: {
        children: React.ReactNode;
      }) => {
        const nhost = createServerClient({
          subdomain: 'local',
          region: 'local',
          storage: new DummySessionStorage(),
        });

        return (
          <NhostProvider nhost={nhost}>
            <AuthProvider>{children}</AuthProvider>
          </NhostProvider>
        );
      };

      render(
        <EmptySessionWrapper>
          <ContextConsumer />
        </EmptySessionWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe(
          'false',
        );
      });

      screen.getByTestId('update-btn').click();

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });
    });

    it('clearIsSigningOut sets isSigningOut to false', async () => {
      render(<ContextConsumer />);

      screen.getByTestId('signout-btn').click();

      await waitFor(() => {
        expect(screen.getByTestId('is-signing-out').textContent).toBe('true');
      });

      screen.getByTestId('clear-signout-btn').click();

      await waitFor(() => {
        expect(screen.getByTestId('is-signing-out').textContent).toBe('false');
      });
    });
  });

  describe('Storage Event Listener', () => {
    it('listens to storage events for nhostSession and updates session', async () => {
      const EmptySessionWrapper = ({
        children,
      }: {
        children: React.ReactNode;
      }) => {
        const nhost = createServerClient({
          subdomain: 'local',
          region: 'local',
          storage: new DummySessionStorage(),
        });

        return (
          <NhostProvider nhost={nhost}>
            <AuthProvider>{children}</AuthProvider>
          </NhostProvider>
        );
      };

      render(
        <EmptySessionWrapper>
          <ContextConsumer />
        </EmptySessionWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe(
          'false',
        );
      });

      // Dispatch a manual storage event
      const storageEvent = new StorageEvent('storage', {
        key: 'nhostSession',
        newValue: JSON.stringify(mockSession),
      });
      window.dispatchEvent(storageEvent);

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      });

      // Dispatch empty storage event to clear session
      const emptyStorageEvent = new StorageEvent('storage', {
        key: 'nhostSession',
        newValue: null,
      });
      window.dispatchEvent(emptyStorageEvent);

      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe(
          'false',
        );
      });
    });
  });
});
