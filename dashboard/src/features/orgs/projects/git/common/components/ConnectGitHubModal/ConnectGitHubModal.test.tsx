import { HttpResponse, http } from 'msw';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
} from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { queryClient, render, screen } from '@/tests/testUtils';
import ConnectGitHubModal from './ConnectGitHubModal';

const providerId = 'github-provider';
const storageKey = 'nhost_provider_tokens_github';
const github = 'https://api.github.com';
const refreshUrl =
  'https://local.auth.local.nhost.run/v1/token/provider/github';
const githubRequests: { path: string; authorization: string | null }[] = [];
const refreshRequests: unknown[] = [];
const { server } = await vi.hoisted(async () => {
  const { setupServer } = await import('msw/node');
  const mockServer = setupServer();
  mockServer.listen({ onUnhandledRequest: 'error' });
  return { server: mockServer };
});

function seedToken(overrides: Record<string, unknown> = {}) {
  const token = {
    authUserProviderId: providerId,
    accessToken: 'test-github-access',
    refreshToken: 'test-github-refresh',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    ...overrides,
  };
  localStorage.setItem(storageKey, JSON.stringify(token));
  return token;
}

function Modal() {
  const [open, setOpen] = useState(true);
  return open ? (
    <ConnectGitHubModal close={() => setOpen(false)} />
  ) : (
    <p>Modal closed</p>
  );
}

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
});
beforeEach(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  localStorage.removeItem(storageKey);
  githubRequests.length = 0;
  refreshRequests.length = 0;
  server.use(
    tokenQuery,
    http.post(
      'https://local.graphql.local.nhost.run/v1',
      async ({ request }) => {
        const { operationName } = (await request.clone().json()) as {
          operationName: string;
        };
        switch (operationName) {
          case 'getProject':
            return HttpResponse.json({ data: { apps: [mockApplication] } });
          case 'getOrganization':
            return HttpResponse.json({
              data: { organizations: [mockOrganization] },
            });
          case 'getAuthUserProviders':
            return HttpResponse.json({
              data: {
                authUserProviders: [{ id: providerId, providerId: 'github' }],
              },
            });
          default:
            return undefined;
        }
      },
    ),
    http.get(`${github}/user/installations`, ({ request }) => {
      githubRequests.push({
        path: new URL(request.url).pathname,
        authorization: request.headers.get('authorization'),
      });
      return HttpResponse.json({
        installations: [
          { id: 7, account: { login: 'fixture-org', avatar_url: '' } },
        ],
      });
    }),
    http.get(`${github}/user/installations/7/repositories`, ({ request }) => {
      githubRequests.push({
        path: new URL(request.url).pathname,
        authorization: request.headers.get('authorization'),
      });
      return HttpResponse.json({
        repositories: [
          {
            id: 1,
            node_id: 'repo-node',
            name: 'fixture-repository',
            full_name: 'fixture-org/fixture-repository',
          },
        ],
      });
    }),
    http.post(refreshUrl, async ({ request }) => {
      refreshRequests.push(await request.json());
      return HttpResponse.json({
        accessToken: 'refreshed-github-access',
        refreshToken: 'rotated-refresh',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      });
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  localStorage.removeItem(storageKey);
  toast.remove();
});
afterAll(() => server.close());

it('asks to connect when there is no GitHub provider', async () => {
  server.use(
    http.post(
      'https://local.graphql.local.nhost.run/v1',
      async ({ request }) => {
        const { operationName } = (await request.clone().json()) as {
          operationName: string;
        };
        return operationName === 'getAuthUserProviders'
          ? HttpResponse.json({ data: { authUserProviders: [] } })
          : undefined;
      },
    ),
  );
  render(<Modal />);
  expect(
    await screen.findByRole('button', { name: /Connect to GitHub/ }),
  ).toBeEnabled();
  expect(githubRequests).toEqual([]);
});

it('shows the provider query error in an alert', async () => {
  server.use(
    http.post(
      'https://local.graphql.local.nhost.run/v1',
      async ({ request }) => {
        const { operationName } = (await request.clone().json()) as {
          operationName: string;
        };
        return operationName === 'getAuthUserProviders'
          ? HttpResponse.json({
              errors: [{ message: 'Provider lookup failed' }],
            })
          : undefined;
      },
    ),
  );
  render(<Modal />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Provider lookup failed',
  );
});

it.each([
  { name: 'missing', token: null },
  { name: 'mismatched', token: { authUserProviderId: 'another-provider' } },
  {
    name: 'expiring without refresh',
    token: {
      authUserProviderId: providerId,
      expiresAt: new Date(0).toISOString(),
      refreshToken: '',
    },
  },
])('asks to sign in for a $name token', async ({ token }) => {
  localStorage.setItem(storageKey, JSON.stringify(token));
  render(<Modal />);
  expect(
    await screen.findByRole('button', { name: /Sign in with GitHub/ }),
  ).toBeEnabled();
  expect(githubRequests).toEqual([]);
});

it('lists repositories with a valid matching token', async () => {
  seedToken();
  render(<Modal />);
  expect(await screen.findByText('fixture-repository')).toBeVisible();
  expect(githubRequests).toEqual([
    { path: '/user/installations', authorization: 'Bearer test-github-access' },
    {
      path: '/user/installations/7/repositories',
      authorization: 'Bearer test-github-access',
    },
  ]);
});

it('refreshes a token inside the 60 second margin, saves it and lists repositories', async () => {
  seedToken({ expiresAt: new Date(Date.now() + 30_000).toISOString() });
  render(<Modal />);
  expect(await screen.findByText('fixture-repository')).toBeVisible();
  expect(refreshRequests).toEqual([{ refreshToken: 'test-github-refresh' }]);
  expect(JSON.parse(localStorage.getItem(storageKey)!)).toMatchObject({
    authUserProviderId: providerId,
    accessToken: 'refreshed-github-access',
    refreshToken: 'rotated-refresh',
  });
  expect(githubRequests[0].authorization).toBe(
    'Bearer refreshed-github-access',
  );
});

it('asks to sign in when refresh returns no body', async () => {
  seedToken({ expiresAt: new Date(0).toISOString() });
  server.use(http.post(refreshUrl, () => HttpResponse.json(null)));
  render(<Modal />);
  expect(
    await screen.findByRole('button', { name: /Sign in with GitHub/ }),
  ).toBeEnabled();
  expect(githubRequests).toEqual([]);
});

it('shows a toast and closes when refresh throws', async () => {
  seedToken({ expiresAt: new Date(0).toISOString() });
  server.use(
    http.post(refreshUrl, () =>
      HttpResponse.json(
        { message: 'Could not refresh GitHub session' },
        { status: 500 },
      ),
    ),
  );
  render(<Modal />);
  expect(await screen.findByText('Modal closed')).toBeVisible();
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Could not refresh GitHub session',
  );
});

it('asks to sign in when installations returns 401', async () => {
  seedToken();
  server.use(
    http.get(`${github}/user/installations`, () =>
      HttpResponse.json({ message: 'Bad credentials' }, { status: 401 }),
    ),
  );
  render(<Modal />);
  expect(
    await screen.findByRole('button', { name: /Sign in with GitHub/ }),
  ).toBeEnabled();
});
