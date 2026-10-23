import { useApolloClient } from '@apollo/client';
import { HttpResponse, http } from 'msw';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/v3/button';
import { SocialProvidersSettings } from '@/features/account/settings/components/SocialProvidersSettings';
import {
  getGitHubToken,
  saveGitHubToken,
} from '@/features/orgs/projects/git/common/utils';
import { GetAuthUserProvidersDocument } from '@/generated/graphql';
import { getGitHubRepository } from '@/lib/github';
import { useAuth } from '@/providers/Auth';
import { useNhostClient } from '@/providers/nhost';
import { mockMatchMediaValue } from '@/tests/mocks';
import nhostGraphQLLink from '@/tests/msw/mocks/graphql/nhostGraphQLLink';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  act,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import useGitHubAccessToken from './useGitHubAccessToken';

const { server } = await vi.hoisted(async () => {
  const { setupServer } = await import('msw/node');
  const mockServer = setupServer();
  mockServer.listen({ onUnhandledRequest: 'error' });
  return { server: mockServer };
});
const refreshUrl =
  'https://local.auth.local.nhost.run/v1/token/provider/github';
let providerId: string | null;
const refreshRequests: unknown[] = [];
const repositoryRequests: string[] = [];

function seedToken(overrides = {}) {
  saveGitHubToken({
    expiresIn: 3600,
    authUserProviderId: 'provider-1',
    accessToken: 'original-access',
    refreshToken: 'original-refresh',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    ...overrides,
  });
}

function Probe({ name }: { name: string }) {
  const result = useGitHubAccessToken();
  useEffect(() => {
    if (result.accessToken) {
      getGitHubRepository(result.accessToken, 'fixture/repo');
    }
  }, [result.accessToken]);
  return <output aria-label={name}>{result.status}</output>;
}

function Harness({
  two = false,
  settings = false,
}: {
  two?: boolean;
  settings?: boolean;
}) {
  const { updateSession } = useAuth();
  const client = useApolloClient();
  const [mounted, setMounted] = useState(true);
  return (
    <>
      {mounted && <Probe name="first" />}
      {!mounted && settings && <SocialProvidersSettings />}
      {two && <Probe name="second" />}
      <Button onClick={() => updateSession(null)}>Sign out</Button>
      <Button
        onClick={() =>
          client.refetchQueries({ include: [GetAuthUserProvidersDocument] })
        }
      >
        Reload provider
      </Button>
      <Button onClick={() => setMounted((value) => !value)}>
        Toggle consumer
      </Button>
    </>
  );
}

function GuardedHarness() {
  const { isAuthenticated } = useAuth();
  const nhost = useNhostClient();
  return (
    <>
      {isAuthenticated && <Probe name="guarded" />}
      <Button onClick={() => nhost.clearSession()}>Expire session</Button>
    </>
  );
}

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
});
beforeEach(() => {
  providerId = 'provider-1';
  localStorage.removeItem('nhost_provider_tokens_github');
  refreshRequests.length = 0;
  repositoryRequests.length = 0;
  server.use(
    tokenQuery,
    http.post('https://local.graphql.local.nhost.run/v1', () =>
      HttpResponse.json({
        data: {
          authUserProviders: providerId
            ? [{ id: providerId, providerId: 'github' }]
            : [],
        },
      }),
    ),
    http.post(refreshUrl, async ({ request }) => {
      refreshRequests.push(await request.json());
      return HttpResponse.json({
        accessToken: 'refreshed-access',
        refreshToken: 'rotated-refresh',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      });
    }),
    http.get('https://api.github.com/repos/fixture/repo', ({ request }) => {
      repositoryRequests.push(request.headers.get('authorization')!);
      return HttpResponse.json({ id: 1, full_name: 'fixture/repo' });
    }),
  );
});
afterEach(() => {
  toast.remove();
  server.resetHandlers();
  queryClient.clear();
  localStorage.removeItem('nhost_provider_tokens_github');
});
afterAll(() => server.close());

it('starts loading while the provider request is pending', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.post('https://local.graphql.local.nhost.run/v1', async () => {
      await gate;
      return HttpResponse.json({ data: { authUserProviders: [] } });
    }),
  );
  render(<Harness />);
  expect(screen.getByLabelText('first')).toHaveTextContent('loading');
  release();
  await waitFor(() =>
    expect(screen.getByLabelText('first')).toHaveTextContent(
      'connection-required',
    ),
  );
});

it.each([
  {
    name: 'no linked provider',
    provider: null,
    stored: null,
    status: 'connection-required',
  },
  {
    name: 'missing token',
    provider: 'provider-1',
    stored: null,
    status: 'expired',
  },
  {
    name: 'mismatched provider',
    provider: 'provider-2',
    stored: { authUserProviderId: 'provider-1' },
    status: 'expired',
  },
  {
    name: 'no refresh token',
    provider: 'provider-1',
    stored: {
      authUserProviderId: 'provider-1',
      expiresAt: new Date(0).toISOString(),
      refreshToken: '',
    },
    status: 'expired',
  },
])('$name gives $status', async ({ provider, stored, status }) => {
  providerId = provider;
  localStorage.setItem('nhost_provider_tokens_github', JSON.stringify(stored));
  render(<Harness />);
  await waitFor(() =>
    expect(screen.getByLabelText('first')).toHaveTextContent(status),
  );
  expect(repositoryRequests).toEqual([]);
});

it('provides a matching unexpired token without refreshing', async () => {
  seedToken();
  render(<Harness />);
  await waitFor(() =>
    expect(repositoryRequests).toEqual(['Bearer original-access']),
  );
  expect(screen.getByLabelText('first')).toHaveTextContent('ready');
  expect(refreshRequests).toEqual([]);
});

it('maps provider query failures to error', async () => {
  server.use(
    http.post('https://local.graphql.local.nhost.run/v1', () =>
      HttpResponse.json({ errors: [{ message: 'Provider unavailable' }] }),
    ),
  );
  render(<Harness />);
  await waitFor(() =>
    expect(screen.getByLabelText('first')).toHaveTextContent('error'),
  );
  expect(repositoryRequests).toEqual([]);
});

it.each([
  { name: 'empty body', status: 200, body: null, expected: 'expired' },
  {
    name: 'throwing refresh',
    status: 500,
    body: { message: 'Refresh failed' },
    expected: 'error',
  },
])('maps $name to $expected', async ({ status, body, expected }) => {
  seedToken({ expiresAt: new Date(0).toISOString() });
  server.use(http.post(refreshUrl, () => HttpResponse.json(body, { status })));
  render(<Harness />);
  await waitFor(() =>
    expect(screen.getByLabelText('first')).toHaveTextContent(expected),
  );
  expect(repositoryRequests).toEqual([]);
});

function delayRefresh() {
  let release!: () => void;
  let received!: () => void;
  const started = new Promise<void>((resolve) => {
    received = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.post(refreshUrl, async ({ request }) => {
      refreshRequests.push(await request.json());
      received();
      await gate;
      return HttpResponse.json({
        accessToken: 'refreshed-access',
        refreshToken: 'rotated-refresh',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      });
    }),
  );
  return {
    started,
    finish: async () => {
      const responded = new Promise<void>((resolve) => {
        const listener = ({ request }: { request: Request }) => {
          if (request.url === refreshUrl) {
            server.events.removeListener('response:mocked', listener);
            resolve();
          }
        };
        server.events.on('response:mocked', listener);
      });
      await act(async () => {
        release();
        await responded;
      });
    },
  };
}

it('refreshes once for two concurrent consumers and supplies the rotated token to both', async () => {
  seedToken({ expiresAt: new Date(Date.now() + 30_000).toISOString() });
  const refresh = delayRefresh();
  render(<Harness two />);
  await refresh.started;
  expect(screen.getByLabelText('first')).toHaveTextContent('loading');
  expect(screen.getByLabelText('second')).toHaveTextContent('loading');
  await refresh.finish();
  await waitFor(() =>
    expect(repositoryRequests).toEqual([
      'Bearer refreshed-access',
      'Bearer refreshed-access',
    ]),
  );
  expect(screen.getByLabelText('first')).toHaveTextContent('ready');
  expect(screen.getByLabelText('second')).toHaveTextContent('ready');
  expect(refreshRequests).toEqual([{ refreshToken: 'original-refresh' }]);
  expect(getGitHubToken()).toMatchObject({
    authUserProviderId: 'provider-1',
    accessToken: 'refreshed-access',
    refreshToken: 'rotated-refresh',
  });
});

it('does not save or use a refresh that completes after sign-out', async () => {
  seedToken({ expiresAt: new Date(0).toISOString() });
  const original = getGitHubToken();
  const refresh = delayRefresh();
  render(<Harness />);
  await refresh.started;
  await new TestUserEvent().click(
    screen.getByRole('button', { name: 'Sign out' }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText('first')).toHaveTextContent(
      'connection-required',
    ),
  );
  await refresh.finish();
  expect(getGitHubToken()).toEqual(original);
  expect(repositoryRequests).toEqual([]);
});

it('does not save or use a refresh when session loss unmounts its consumer', async () => {
  seedToken({ expiresAt: new Date(0).toISOString() });
  const original = getGitHubToken();
  const refresh = delayRefresh();
  render(<GuardedHarness />);
  await refresh.started;
  await new TestUserEvent().click(
    screen.getByRole('button', { name: 'Expire session' }),
  );
  await waitFor(() =>
    expect(screen.queryByLabelText('guarded')).not.toBeInTheDocument(),
  );
  await refresh.finish();
  expect(getGitHubToken()).toEqual(original);
  expect(repositoryRequests).toEqual([]);
});

it('does not save or use a refresh after the linked provider changes', async () => {
  seedToken({ expiresAt: new Date(0).toISOString() });
  const original = getGitHubToken();
  const refresh = delayRefresh();
  render(<Harness />);
  await refresh.started;
  providerId = 'provider-2';
  await new TestUserEvent().click(
    screen.getByRole('button', { name: 'Reload provider' }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText('first')).toHaveTextContent('expired'),
  );
  await refresh.finish();
  expect(getGitHubToken()).toEqual(original);
  expect(repositoryRequests).toEqual([]);
});

it.each([
  { change: 'removed', nextProvider: null, expected: 'connection-required' },
  { change: 'replaced', nextProvider: 'provider-2', expected: 'expired' },
])(
  'does not save or use a refresh when the provider is $change after the last consumer unmounts',
  async ({ nextProvider, expected }) => {
    seedToken({ expiresAt: new Date(0).toISOString() });
    const original = getGitHubToken();
    const refresh = delayRefresh();
    const user = new TestUserEvent();
    render(<Harness />);
    await refresh.started;
    await user.click(screen.getByRole('button', { name: 'Toggle consumer' }));
    providerId = nextProvider;
    await refresh.finish();
    expect(getGitHubToken()).toEqual(original);
    expect(repositoryRequests).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Toggle consumer' }));
    await waitFor(() =>
      expect(screen.getByLabelText('first')).toHaveTextContent(expected),
    );
    expect(repositoryRequests).toEqual([]);
  },
);

it("does not save or use a refresh after the closed consumer's provider is disconnected in account settings", async () => {
  seedToken({ expiresAt: new Date(0).toISOString() });
  const original = getGitHubToken();
  const refresh = delayRefresh();
  const disconnectRequests: unknown[] = [];
  server.use(
    nhostGraphQLLink.mutation('deleteAuthUserProvider', ({ variables }) => {
      disconnectRequests.push(variables);
      providerId = null;
      return HttpResponse.json({
        data: { deleteAuthUserProvider: { __typename: 'authUserProviders' } },
      });
    }),
  );
  const user = new TestUserEvent();
  render(<Harness settings />);
  await refresh.started;
  await user.click(screen.getByRole('button', { name: 'Toggle consumer' }));
  await user.click(
    await screen.findByRole('button', { name: 'Disconnect GitHub' }),
  );
  await user.click(
    screen.getByRole('checkbox', { name: 'Confirm disconnect GitHub' }),
  );
  await user.click(screen.getByRole('button', { name: 'Disconnect' }));
  expect(
    await screen.findByRole('button', { name: /Connect with GitHub/ }),
  ).toBeEnabled();
  expect(disconnectRequests).toEqual([{ id: 'provider-1' }]);
  await refresh.finish();
  expect(getGitHubToken()).toEqual(original);
  expect(repositoryRequests).toEqual([]);
  await user.click(screen.getByRole('button', { name: 'Toggle consumer' }));
  await waitFor(() =>
    expect(screen.getByLabelText('first')).toHaveTextContent(
      'connection-required',
    ),
  );
  expect(repositoryRequests).toEqual([]);
});

it('keeps observing session loss until delayed provider validation completes', async () => {
  seedToken({ expiresAt: new Date(0).toISOString() });
  const original = getGitHubToken();
  const refresh = delayRefresh();
  render(<GuardedHarness />);
  await refresh.started;
  let validate!: () => void;
  let received!: () => void;
  const started = new Promise<void>((resolve) => {
    received = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    validate = resolve;
  });
  const responded = new Promise<void>((resolve) => {
    const listener = ({ request }: { request: Request }) => {
      if (request.url === 'https://local.graphql.local.nhost.run/v1') {
        server.events.removeListener('response:mocked', listener);
        resolve();
      }
    };
    server.events.on('response:mocked', listener);
  });
  server.use(
    nhostGraphQLLink.query('getAuthUserProviders', async () => {
      received();
      await gate;
      return HttpResponse.json({
        data: {
          authUserProviders: [{ id: 'provider-1', providerId: 'github' }],
        },
      });
    }),
  );
  await refresh.finish();
  await started;
  expect(screen.getByLabelText('guarded')).toHaveTextContent('loading');
  await new TestUserEvent().click(
    screen.getByRole('button', { name: 'Expire session' }),
  );
  await waitFor(() =>
    expect(screen.queryByLabelText('guarded')).not.toBeInTheDocument(),
  );
  await act(async () => {
    validate();
    await responded;
  });
  expect(getGitHubToken()).toEqual(original);
  expect(repositoryRequests).toEqual([]);
});

it('does not save or use a rotation when fresh provider validation fails', async () => {
  seedToken({ expiresAt: new Date(0).toISOString() });
  const original = getGitHubToken();
  const refresh = delayRefresh();
  render(<Harness />);
  await refresh.started;
  server.use(
    nhostGraphQLLink.query('getAuthUserProviders', () =>
      HttpResponse.json({ errors: [{ message: 'Provider unavailable' }] }),
    ),
  );
  await refresh.finish();
  await waitFor(() =>
    expect(screen.getByLabelText('first')).toHaveTextContent('error'),
  );
  expect(getGitHubToken()).toEqual(original);
  expect(repositoryRequests).toEqual([]);
});

it("preserves a newer provider's stored credentials when an unmounted refresh settles", async () => {
  seedToken({ expiresAt: new Date(0).toISOString() });
  const refresh = delayRefresh();
  const user = new TestUserEvent();
  render(<Harness />);
  await refresh.started;
  await user.click(screen.getByRole('button', { name: 'Toggle consumer' }));
  providerId = 'provider-2';
  seedToken({
    authUserProviderId: providerId,
    accessToken: 'new-provider-access',
  });
  const current = getGitHubToken();
  await refresh.finish();
  expect(getGitHubToken()).toEqual(current);
  expect(repositoryRequests).toEqual([]);
  await user.click(screen.getByRole('button', { name: 'Toggle consumer' }));
  await waitFor(() =>
    expect(repositoryRequests).toEqual(['Bearer new-provider-access']),
  );
});

it('reads storage again when a new consumer mounts', async () => {
  seedToken();
  render(<Harness />);
  await waitFor(() =>
    expect(repositoryRequests).toEqual(['Bearer original-access']),
  );
  const user = new TestUserEvent();
  await user.click(screen.getByRole('button', { name: 'Toggle consumer' }));
  seedToken({ accessToken: 'newly-signed-in-access' });
  await user.click(screen.getByRole('button', { name: 'Toggle consumer' }));
  await waitFor(() =>
    expect(repositoryRequests).toEqual([
      'Bearer original-access',
      'Bearer newly-signed-in-access',
    ]),
  );
});

it('retains a rotated token if the consumer unmounts without signing out', async () => {
  seedToken({ expiresAt: new Date(0).toISOString() });
  const refresh = delayRefresh();
  const user = new TestUserEvent();
  render(<Harness />);
  await refresh.started;
  await user.click(screen.getByRole('button', { name: 'Toggle consumer' }));
  await refresh.finish();
  expect(getGitHubToken()).toMatchObject({
    accessToken: 'refreshed-access',
    refreshToken: 'rotated-refresh',
  });
  expect(repositoryRequests).toEqual([]);
  await user.click(screen.getByRole('button', { name: 'Toggle consumer' }));
  await waitFor(() =>
    expect(repositoryRequests).toEqual(['Bearer refreshed-access']),
  );
  expect(refreshRequests).toEqual([{ refreshToken: 'original-refresh' }]);
});
