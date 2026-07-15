import { createServerClient } from '@nhost/nhost-js';
import { useRouter } from 'next/router';
import type React from 'react';
import { useContext } from 'react';
import { toast } from 'react-hot-toast';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import * as gitUtils from '@/features/orgs/projects/git/common/utils';
import { AuthContext } from '@/providers/Auth/AuthContext';
import AuthProvider from '@/providers/Auth/AuthProvider';
import { NhostProvider } from '@/providers/nhost';
import { render, screen, waitFor } from '@/tests/testUtils';
import { DummySessionStorage } from '@/utils/nhost';

// Mock next/router globally, ensuring we provide both useRouter and the default Router export
vi.mock('next/router', () => {
  const push = vi.fn();
  const replace = vi.fn();
  return {
    default: {
      query: {},
      push,
      replace,
      pathname: '/',
    },
    useRouter: vi.fn(() => ({
      query: {},
      isReady: true,
      push,
      replace,
      pathname: '/',
    })),
  };
});

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
        onClick={() =>
          ctx?.updateSession({ refreshToken: 'new-token' } as unknown)
        }
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
  let mockPush: ReturnType<typeof vi.fn>;
  let mockReplace: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // Deprecated
        removeListener: vi.fn(), // Deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockPush = vi.fn();
    mockReplace = vi.fn();

    vi.mocked(useRouter).mockReturnValue({
      query: {},
      isReady: true,
      push: mockPush,
      replace: mockReplace,
      pathname: '/',
    });

    // Also update the default export for useRemoveQueryParamsFromUrl
    vi.spyOn(toast, 'error');
    vi.spyOn(gitUtils, 'clearGitHubToken');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization Error Handling', () => {
    it('redirects to /email/verify when error is unverified-user', async () => {
      vi.mocked(useRouter).mockReturnValue({
        query: { error: 'unverified-user' },
        isReady: true,
        push: mockPush,
        replace: mockReplace,
        pathname: '/',
      });

      render(<div>Child</div>);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/email/verify');
      });
    });

    it('redirects to github-modal when error is invalid-state and provider_state matches install-github-app', async () => {
      const query = {
        error: 'invalid-state',
        provider_state: 'install-github-app:my-org:my-proj',
      };

      vi.mocked(useRouter).mockReturnValue({
        query,
        isReady: true,
        push: mockPush,
        replace: mockReplace,
        pathname: '/',
      });

      render(<div>Child</div>);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/orgs/my-org/projects/my-proj/settings/deployments?github-modal',
        );
      });
    });

    it('shows toast and redirects to /signin for generic invalid-state fallback', async () => {
      const query = {
        error: 'invalid-state',
        provider_state: 'some-other-state',
      };

      vi.mocked(useRouter).mockReturnValue({
        query,
        isReady: true,
        push: mockPush,
        replace: mockReplace,
        pathname: '/',
      });

      render(<div>Child</div>);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'An error occurred during the sign-in process. Please try again.',
          expect.any(Object),
        );
        expect(mockPush).toHaveBeenCalledWith('/signin');
      });
    });

    it('shows toast with errorDescription and redirects to /signin for unknown errors', async () => {
      const query = {
        error: 'server_error',
        errorDescription: 'Custom error message from server',
      };

      vi.mocked(useRouter).mockReturnValue({
        query,
        isReady: true,
        push: mockPush,
        replace: mockReplace,
        pathname: '/',
      });

      render(<div>Child</div>);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Custom error message from server',
          expect.any(Object),
        );
        expect(mockPush).toHaveBeenCalledWith('/signin');
      });
    });
  });

  describe('Re-render Edge Cases', () => {
    it('ignores query param changes after initial mount due to intentional dependency array', async () => {
      const { rerender } = render(<div>Child</div>);

      // Simulate a route change that adds an error query param
      const query = { error: 'unverified-user' };
      vi.mocked(useRouter).mockReturnValue({
        query,
        isReady: true,
        push: mockPush,
        replace: mockReplace,
        pathname: '/',
      });

      rerender(<div>Child</div>);

      // Wait a short time to verify NO side effects happened
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockPush).not.toHaveBeenCalled();
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
        expect(mockPush).toHaveBeenCalledWith('/signin');
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
        newValue: JSON.stringify({
          user: { id: 'user-1' },
          refreshToken: 'token',
        }),
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
