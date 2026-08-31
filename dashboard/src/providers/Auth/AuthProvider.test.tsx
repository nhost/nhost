/// <reference types="vitest/globals" />
import {
  ApolloClient,
  ApolloProvider,
  createHttpLink,
  InMemoryCache,
} from '@apollo/client';
import { createServerClient } from '@nhost/nhost-js';
import type { ProviderSession } from '@nhost/nhost-js/auth';
import { HttpResponse, type HttpResponseResolver, http } from 'msw';
import { setupServer } from 'msw/node';
import type { NextRouter } from 'next/router';
import type React from 'react';
import { useContext } from 'react';
import { Toaster, toast } from 'react-hot-toast';

import * as gitUtils from '@/features/orgs/projects/git/common/utils';
import { AuthContext } from '@/providers/Auth/AuthContext';
import AuthProvider from '@/providers/Auth/AuthProvider';
import { NhostProvider } from '@/providers/nhost';
import { mockMatchMediaValue, mockRouter, mockSession } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
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

const authUrl = 'https://local.auth.local.nhost.run/v1';

const server = setupServer(
  http.post(`${authUrl}/token/exchange`, () =>
    HttpResponse.json({ session: mockSession }),
  ),
  http.post(
    `${authUrl}/signout`,
    () => new HttpResponse(null, { status: 204 }),
  ),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const providerTokensErrorMessage =
  'Signed in, but we could not retrieve your GitHub credentials. Please try signing in with GitHub again.';

// Create a component that consumes the AuthContext to trigger and test state changes
const ContextConsumer = () => {
  const ctx = useContext(AuthContext);

  return (
    <div>
      <span data-testid="is-authenticated">
        {ctx?.isAuthenticated ? 'true' : 'false'}
      </span>
      <span data-testid="is-loading">{ctx?.isLoading ? 'true' : 'false'}</span>
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

  describe('GitHub provider tokens', () => {
    const baseQuery = {
      code: 'auth-code',
      pkceId: 'pkce-1',
      signinProvider: 'github',
    };

    const renderGithubCallback = (
      query: NextRouter['query'],
      providerTokens: HttpResponseResolver,
    ) => {
      localStorage.setItem('nhost_pkce_verifier:pkce-1', 'verifier');
      mocks.useRouter.mockReturnValue({ ...mockRouter, query });
      server.use(
        http.get(
          `${authUrl}/signin/provider/github/callback/tokens`,
          providerTokens,
        ),
      );

      const nhost = createServerClient({
        subdomain: 'local',
        region: 'local',
        storage: new DummySessionStorage(),
      });

      const apolloClient = new ApolloClient({
        cache: new InMemoryCache(),
        link: createHttpLink({
          uri: 'https://local.graphql.local.nhost.run/v1',
        }),
        defaultOptions: {
          query: { fetchPolicy: 'no-cache' },
          watchQuery: { fetchPolicy: 'no-cache' },
        },
      });

      const GitHubCallbackWrapper = ({
        children,
      }: {
        children: React.ReactNode;
      }) => (
        <NhostProvider nhost={nhost}>
          <ApolloProvider client={apolloClient}>
            <AuthProvider>
              <Toaster />
              {children}
            </AuthProvider>
          </ApolloProvider>
        </NhostProvider>
      );

      return render(<ContextConsumer />, { wrapper: GitHubCallbackWrapper });
    };

    beforeEach(() => {
      toast.remove();
      localStorage.clear();
      sessionStorage.clear();
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      toast.remove();
      localStorage.clear();
      sessionStorage.clear();
    });

    it('shows an error without blocking sign-in when provider tokens fail', async () => {
      renderGithubCallback(baseQuery, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      );

      expect(
        await screen.findByText(providerTokensErrorMessage),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('is-authenticated').textContent).toBe('true');
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });
      expect(mockRouter.push).not.toHaveBeenCalledWith('/signin');
      expect(gitUtils.getGitHubToken()).toBeNull();
    });

    it('keeps the signin-refresh redirect when provider tokens fail', async () => {
      renderGithubCallback(
        { ...baseQuery, state: 'signin-refresh:my-org:my-proj' },
        () => HttpResponse.json({ message: 'boom' }, { status: 500 }),
      );

      expect(
        await screen.findByText(providerTokensErrorMessage),
      ).toBeInTheDocument();
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(
          '/orgs/my-org/projects/my-proj/settings/deployments?github-modal',
        );
      });
      expect(mockRouter.push).not.toHaveBeenCalledWith('/signin');
    });

    it('saves valid provider tokens without showing an error', async () => {
      const providerTokens: ProviderSession = {
        accessToken: 'gh',
        refreshToken: 'r',
        expiresIn: 3599,
        expiresAt: '2099-01-01T00:00:00.000Z',
      };
      server.use(
        nhostGraphQLLink.query('getAuthUserProviders', () =>
          HttpResponse.json({
            data: {
              authUserProviders: [
                { id: 'auth-user-provider-1', providerId: 'github' },
              ],
            },
          }),
        ),
      );

      renderGithubCallback(baseQuery, () => HttpResponse.json(providerTokens));

      await waitFor(() => {
        expect(gitUtils.getGitHubToken()).toEqual({
          ...providerTokens,
          authUserProviderId: 'auth-user-provider-1',
        });
        expect(screen.getByTestId('is-loading').textContent).toBe('false');
      });
      expect(screen.queryByText(providerTokensErrorMessage)).toBeNull();
    });

    it.each([
      ['empty object', () => HttpResponse.json({})],
      ['no content', () => new HttpResponse(null, { status: 204 })],
    ])(
      'shows an error and skips saving for a %s response body',
      async (_bodyType, providerTokens) => {
        renderGithubCallback(baseQuery, providerTokens);

        expect(
          await screen.findByText(providerTokensErrorMessage),
        ).toBeInTheDocument();
        await waitFor(() => {
          expect(screen.getByTestId('is-loading').textContent).toBe('false');
        });
        expect(gitUtils.getGitHubToken()).toBeNull();
      },
    );
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
