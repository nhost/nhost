import { render, screen, act } from '@testing-library/react';
import { useRouter } from 'next/router';
import { vi, describe, it, expect, beforeEach, afterEach, Mock } from 'vitest';
import { toast } from 'react-hot-toast';
import { AuthProvider, AuthContext } from './index';
import { useRemoveQueryParamsFromUrl } from '@/hooks/useRemoveQueryParamsFromUrl';
import { clearGitHubToken } from '@/features/orgs/projects/git/common/utils';
import { useContext } from 'react';

// 1. Mock the next/router to allow dynamic query modifications
vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

// 2. Mock hooks and toast
vi.mock('@/hooks/useRemoveQueryParamsFromUrl', () => ({
  useRemoveQueryParamsFromUrl: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
  },
}));

// 3. Mock the github token util
vi.mock('@/features/orgs/projects/git/common/utils', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    clearGitHubToken: vi.fn(),
  };
});

// 4. Mock the apollo query since AuthProvider uses useGetAuthUserProvidersLazyQuery
vi.mock('@/utils/__generated__/graphql', () => ({
  useGetAuthUserProvidersLazyQuery: () => [vi.fn().mockResolvedValue({ data: null })],
}));

// 5. Mock the Nhost client hook
const mockSignOut = vi.fn();
const mockTokenExchange = vi.fn();
const mockGetProviderTokens = vi.fn();
const mockOnSessionChange = vi.fn().mockReturnValue(vi.fn()); // returns unsubscribe function
const mockGetUserSession = vi.fn();
const mockSessionStorageGet = vi.fn();

vi.mock('@/providers/nhost/', () => ({
  useNhostClient: () => ({
    auth: {
      signOut: mockSignOut,
      tokenExchange: mockTokenExchange,
      getProviderTokens: mockGetProviderTokens,
    },
    sessionStorage: {
      onChange: mockOnSessionChange,
      get: mockSessionStorageGet,
    },
    getUserSession: mockGetUserSession,
  }),
}));

const removableParams = [
  'code',
  'error',
  'errorDescription',
  'pkceId',
  'signinProvider',
  'state',
  'provider_state',
];

// Helper to access AuthContext
const ContextConsumer = () => {
  const ctx = useContext(AuthContext);
  return (
    <div>
      <span data-testid="is-authenticated">{ctx?.isAuthenticated ? 'true' : 'false'}</span>
      <span data-testid="is-signing-out">{ctx?.isSigningOut ? 'true' : 'false'}</span>
      <button type="button" onClick={() => ctx?.signout()} data-testid="signout-btn">Sign Out</button>
      <button type="button" onClick={() => ctx?.updateSession({ refreshToken: 'new-token' } as any)} data-testid="update-btn">Update Session</button>
      <button type="button" onClick={() => ctx?.clearIsSigningOut()} data-testid="clear-signout-btn">Clear Signout</button>
    </div>
  );
};

describe('AuthProvider', () => {
  let mockPush: Mock;
  let mockRemoveQueryParams: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockPush = vi.fn();
    (useRouter as Mock).mockReturnValue({
      query: {},
      isReady: true,
      push: mockPush,
    });

    mockRemoveQueryParams = vi.fn();
    (useRemoveQueryParamsFromUrl as Mock).mockReturnValue(mockRemoveQueryParams);
    
    mockGetUserSession.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization Error Handling', () => {
    it('redirects to /email/verify when error is unverified-user', async () => {
      (useRouter as Mock).mockReturnValue({
        query: { error: 'unverified-user' },
        isReady: true,
        push: mockPush,
      });

      render(
        <AuthProvider>
          <div>Child</div>
        </AuthProvider>
      );

      // wait for effect
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockRemoveQueryParams).toHaveBeenCalledWith(...removableParams);
      expect(mockPush).toHaveBeenCalledWith('/email/verify');
    });

    it('redirects to github-modal when error is invalid-state and provider_state matches install-github-app', async () => {
      (useRouter as Mock).mockReturnValue({
        query: { 
          error: 'invalid-state', 
          provider_state: 'install-github-app:my-org:my-proj' 
        },
        isReady: true,
        push: mockPush,
      });

      render(
        <AuthProvider>
          <div>Child</div>
        </AuthProvider>
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockRemoveQueryParams).toHaveBeenCalledWith(...removableParams);
      expect(mockPush).toHaveBeenCalledWith('/orgs/my-org/projects/my-proj/settings/deployments?github-modal');
    });

    it('shows toast and redirects to /signin for generic invalid-state fallback', async () => {
      (useRouter as Mock).mockReturnValue({
        query: { 
          error: 'invalid-state', 
          provider_state: 'some-other-state' 
        },
        isReady: true,
        push: mockPush,
      });

      render(
        <AuthProvider>
          <div>Child</div>
        </AuthProvider>
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(toast.error).toHaveBeenCalledWith('An error occurred during the sign-in process. Please try again.', expect.any(Object));
      expect(mockRemoveQueryParams).toHaveBeenCalledWith(...removableParams);
      expect(mockPush).toHaveBeenCalledWith('/signin');
    });

    it('shows toast with errorDescription and redirects to /signin for unknown errors', async () => {
      (useRouter as Mock).mockReturnValue({
        query: { 
          error: 'server_error', 
          errorDescription: 'Custom error message from server' 
        },
        isReady: true,
        push: mockPush,
      });

      render(
        <AuthProvider>
          <div>Child</div>
        </AuthProvider>
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(toast.error).toHaveBeenCalledWith('Custom error message from server', expect.any(Object));
      expect(mockRemoveQueryParams).toHaveBeenCalledWith(...removableParams);
      expect(mockPush).toHaveBeenCalledWith('/signin');
    });
  });

  describe('Re-render Edge Cases', () => {
    it('ignores query param changes after initial mount due to intentional dependency array', async () => {
      const { rerender } = render(
        <AuthProvider>
          <div>Child</div>
        </AuthProvider>
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      
      expect(mockPush).not.toHaveBeenCalled();

      // Simulate a route change that adds an error query param
      (useRouter as Mock).mockReturnValue({
        query: { error: 'unverified-user' },
        isReady: true,
        push: mockPush,
      });

      rerender(
        <AuthProvider>
          <div>Child</div>
        </AuthProvider>
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // It should NOT call removeQueryParams or push because the effect only runs on mount
      // as indicated by the biome-ignore comment in the source.
      expect(mockRemoveQueryParams).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('AuthContext Methods', () => {
    it('signout updates state, calls nhost.auth.signOut and redirects', async () => {
      // Provide a mock session to prevent crash on signout
      mockGetUserSession.mockReturnValue({ refreshToken: 'valid-refresh-token' });

      render(
        <AuthProvider>
          <ContextConsumer />
        </AuthProvider>
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      expect(screen.getByTestId('is-signing-out').textContent).toBe('false');

      await act(async () => {
        screen.getByTestId('signout-btn').click();
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false'); // session set to null
      expect(screen.getByTestId('is-signing-out').textContent).toBe('true');
      
      expect(mockSignOut).toHaveBeenCalledWith({ refreshToken: 'valid-refresh-token' });
      expect(clearGitHubToken).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/signin');
    });

    it('signout throws TypeError if session is null', async () => {
      // Mock session is null initially
      mockGetUserSession.mockReturnValue(null);
      let contextValue: any = null;

      const ContextCapturer = () => {
        contextValue = useContext(AuthContext);
        return <div>Child</div>;
      };

      render(
        <AuthProvider>
          <ContextCapturer />
        </AuthProvider>
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Call signout directly to catch the promise rejection and wrap in act
      let caughtError: any;
      await act(async () => {
        try {
          await contextValue.signout();
        } catch (error) {
          caughtError = error;
        }
      });
      expect(caughtError).toBeInstanceOf(TypeError);
    });

    it('updateSession correctly updates the context session', async () => {
      render(
        <AuthProvider>
          <ContextConsumer />
        </AuthProvider>
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');

      await act(async () => {
        screen.getByTestId('update-btn').click();
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
    });

    it('clearIsSigningOut sets isSigningOut to false', async () => {
      // Provide session and trigger signout to set isSigningOut to true
      mockGetUserSession.mockReturnValue({ refreshToken: 'valid-refresh-token' });
      
      render(
        <AuthProvider>
          <ContextConsumer />
        </AuthProvider>
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        screen.getByTestId('signout-btn').click();
      });

      expect(screen.getByTestId('is-signing-out').textContent).toBe('true');

      await act(async () => {
        screen.getByTestId('clear-signout-btn').click();
      });

      expect(screen.getByTestId('is-signing-out').textContent).toBe('false');
    });
  });

  describe('Storage Event Listener', () => {
    it('listens to storage events for nhostSession and updates session', async () => {
      render(
        <AuthProvider>
          <ContextConsumer />
        </AuthProvider>
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');

      // Dispatch a manual storage event
      await act(async () => {
        const storageEvent = new StorageEvent('storage', {
          key: 'nhostSession',
          newValue: JSON.stringify({ user: { id: 'user-1' }, refreshToken: 'token' }),
        });
        window.dispatchEvent(storageEvent);
      });

      // Assert session updated
      expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
      
      // Dispatch empty storage event to clear session
      await act(async () => {
        const storageEvent = new StorageEvent('storage', {
          key: 'nhostSession',
          newValue: null,
        });
        window.dispatchEvent(storageEvent);
      });

      expect(screen.getByTestId('is-authenticated').textContent).toBe('false');
    });

    it('calls nhost.sessionStorage.onChange on mount', () => {
      render(
        <AuthProvider>
          <div>Child</div>
        </AuthProvider>
      );
      
      expect(mockOnSessionChange).toHaveBeenCalled();
    });
  });
});
