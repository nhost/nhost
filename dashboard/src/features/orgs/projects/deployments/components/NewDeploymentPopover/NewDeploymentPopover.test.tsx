import {
  ApolloClient,
  ApolloProvider,
  createHttpLink,
  InMemoryCache,
} from '@apollo/client';
import { RetryLink } from '@apollo/client/link/retry';
import { getMainDefinition } from '@apollo/client/utilities';
import { HttpResponse, http } from 'msw';
import { toast } from 'react-hot-toast';
import type {
  InsertPipelineRunMutationVariables,
  SearchUnifiedDeploymentsQueryVariables,
  UnifiedDeploymentRowFragment,
} from '@/generated/graphql';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
} from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import {
  mockScrollIntoViewAndPointerCapture,
  queryClient,
  render,
  screen,
  TestUserEvent,
  waitFor,
  within,
} from '@/tests/testUtils';
import NewDeploymentPopover from './NewDeploymentPopover';

const { server } = await vi.hoisted(async () => {
  const { setupServer } = await import('msw/node');
  const mockServer = setupServer();
  mockServer.listen({ onUnhandledRequest: 'error' });
  return { server: mockServer };
});

const endpoint = 'https://local.graphql.local.nhost.run/v1';
const github = 'https://api.github.com';
const repository = `${github}/repos/test/git-project`;
const storageKey = 'nhost_provider_tokens_github';
const targetSHA = 'b'.repeat(40);
const live: UnifiedDeploymentRowFragment = {
  id: 'live',
  appId: '1',
  source: 'pipeline_run',
  commitSHA: 'a'.repeat(40),
  commitMessage: 'Live commit',
  commitUserName: 'Alice',
  commitUserAvatarUrl: null,
  status: 'succeeded',
  createdAt: '2026-10-20T12:00:00Z',
  startedAt: '2026-10-20T12:01:00Z',
  endedAt: '2026-10-20T12:02:00Z',
};
const stored: UnifiedDeploymentRowFragment = {
  ...live,
  id: 'stored',
  commitSHA: 'c'.repeat(40),
  commitMessage: 'Stored comments update',
  commitUserName: 'Stored author',
  commitUserAvatarUrl: 'https://avatars.githubusercontent.com/u/1',
  createdAt: '2026-10-19T12:00:00Z',
};
const historyRows: UnifiedDeploymentRowFragment[] = [
  live,
  stored,
  { ...stored, id: 'duplicate' },
  { ...stored, id: 'ref', commitSHA: 'release', commitMessage: 'Stored ref' },
];
const requests: InsertPipelineRunMutationVariables[] = [];
const gitPaths: string[] = [];
const props = { liveDeployment: live, ready: true, inProgress: false };

function commitResponse(sha = targetSHA, message = 'Add reactions') {
  return {
    sha,
    commit: {
      message,
      author: { name: 'Author', date: '2026-10-20T13:00:00Z' },
      committer: null,
    },
    author: { login: 'author', avatar_url: null },
    committer: null,
  };
}

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createHistoryRetryClient() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new RetryLink({
      delay: { initial: 2_000, max: 2_000, jitter: false },
      attempts: {
        max: 5,
        retryIf: (error, operation) => {
          const definition = getMainDefinition(operation.query);
          return (
            Boolean(error) &&
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'query'
          );
        },
      },
    }).concat(createHttpLink({ uri: endpoint })),
    defaultOptions: {
      query: { fetchPolicy: 'no-cache' },
      watchQuery: { fetchPolicy: 'no-cache' },
    },
  });
}

async function openPopover() {
  const user = new TestUserEvent();
  await user.click(
    await screen.findByRole('button', { name: /New deployment/ }),
  );
  return user;
}

async function typeRef(user: TestUserEvent, value: string) {
  const input = screen.getByRole('combobox', { name: 'Branch, tag or commit' });
  await user.clear(input);
  await user.type(input, value);
}

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  mockScrollIntoViewAndPointerCapture();
});
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  requests.length = 0;
  gitPaths.length = 0;
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      authUserProviderId: 'github-provider',
      accessToken: 'fixture-access',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }),
  );
  server.use(
    tokenQuery,
    http.post(endpoint, async ({ request }) => {
      const { operationName, variables } = (await request.clone().json()) as {
        operationName: string;
        variables: InsertPipelineRunMutationVariables;
      };
      switch (operationName) {
        case 'getProject':
          return HttpResponse.json({
            data: {
              apps: [
                { ...mockApplication, repositoryProductionBranch: 'main' },
              ],
            },
          });
        case 'getOrganization':
          return HttpResponse.json({
            data: { organizations: [mockOrganization] },
          });
        case 'getAuthUserProviders':
          return HttpResponse.json({
            data: {
              authUserProviders: [
                { id: 'github-provider', providerId: 'github' },
              ],
            },
          });
        case 'getUnifiedDeploymentsSub':
          return HttpResponse.json({
            data: { unifiedDeployments: historyRows },
          });
        case 'searchUnifiedDeployments':
          return HttpResponse.json({ data: { unifiedDeployments: [] } });
        case 'GetOrganizations':
          return HttpResponse.json({ data: { organizations: [] } });
        case 'InsertPipelineRun':
          requests.push(variables);
          return HttpResponse.json({
            data: {
              insertPipelineRun: {
                id: 'new',
                name: 'nhost-backend-build',
                status: 'pending',
                input: variables.object.input,
                appId: '1',
                createdAt: live.createdAt,
                startedAt: null,
                endedAt: null,
              },
            },
          });
        default:
          return undefined;
      }
    }),
    http.get(repository, ({ request }) => {
      gitPaths.push(new URL(request.url).pathname);
      return HttpResponse.json({ full_name: 'test/git-project' });
    }),
    http.get(`${repository}/commits`, ({ request }) => {
      gitPaths.push(
        new URL(request.url).pathname + new URL(request.url).search,
      );
      return HttpResponse.json([]);
    }),
    http.get(`${repository}/git/matching-refs/*`, ({ request }) => {
      gitPaths.push(new URL(request.url).pathname);
      return HttpResponse.json([]);
    }),
    http.get(`${repository}/commits/*`, ({ request }) => {
      gitPaths.push(new URL(request.url).pathname);
      return HttpResponse.json(commitResponse());
    }),
    http.get(`${repository}/compare/*`, ({ request }) => {
      gitPaths.push(new URL(request.url).pathname);
      return HttpResponse.json({ status: 'ahead', ahead_by: 2, behind_by: 0 });
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  localStorage.removeItem(storageKey);
  toast.remove();
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

it('resolves the deployment branch and shows its relation to live', async () => {
  render(<NewDeploymentPopover {...props} />);
  await openPopover();
  expect(
    await screen.findByText('2 commits ahead of the live deployment'),
  ).toBeVisible();
  expect(screen.getByRole('combobox')).toHaveValue('main');
  expect(screen.getByText('deployment branch')).toBeVisible();
  expect(screen.getByText('Add reactions')).toBeVisible();
  expect(screen.getByText('author')).toBeVisible();
  expect(screen.getByText('bbbbbbb')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled();
  expect(gitPaths).toContain('/repos/test/git-project/commits/main');
});

it('resolves a short SHA and warns when it is behind live', async () => {
  server.use(
    http.get(`${repository}/commits/abc1234`, () =>
      HttpResponse.json(commitResponse('c'.repeat(40), 'Older commit')),
    ),
    http.get(`${repository}/compare/*`, () =>
      HttpResponse.json({ status: 'behind', ahead_by: 0, behind_by: 1 }),
    ),
  );
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await typeRef(user, 'abc1234');
  expect(await screen.findByText('Older commit')).toBeVisible();
  expect(
    await screen.findByText('1 commit behind the live deployment'),
  ).toBeVisible();
  expect(
    screen.getByText(
      "This commit's metadata, settings and functions replace the current ones.",
    ),
  ).toBeVisible();
  expect(
    screen.getByText('Database migrations are not rolled back.'),
  ).toBeVisible();
});

it.each(['feed', '2024', 'a1', 'feat/comments', 'v1.0'])(
  'resolves the exact ref %s to a full commit',
  async (ref) => {
    server.use(
      http.get(`${repository}/commits/${ref}`, () =>
        HttpResponse.json(commitResponse('c'.repeat(40), `Resolved ${ref}`)),
      ),
    );
    render(<NewDeploymentPopover {...props} />);
    const user = await openPopover();
    await typeRef(user, ref);
    expect(await screen.findByText(`Resolved ${ref}`)).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Deploy' }));
    await waitFor(() =>
      expect(requests[0]?.object.input.commit_sha).toBe('c'.repeat(40)),
    );
  },
);

it('disables Deploy while comparing, then enables it', async () => {
  const comparison = deferred();
  server.use(
    http.get(`${repository}/compare/*`, async () => {
      await comparison.promise;
      return HttpResponse.json({ status: 'ahead', ahead_by: 2, behind_by: 0 });
    }),
  );
  render(<NewDeploymentPopover {...props} />);
  await openPopover();
  expect(
    await screen.findByText('Comparing with the live deployment...'),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
  comparison.resolve();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
  );
});

it('waits for activity readiness and recomputes the relation when live changes', async () => {
  const { rerender } = render(
    <NewDeploymentPopover {...props} ready={false} />,
  );
  await openPopover();
  expect(await screen.findByText('Add reactions')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
  rerender(<NewDeploymentPopover {...props} />);
  expect(
    await screen.findByText('2 commits ahead of the live deployment'),
  ).toBeVisible();
  const newLive = 'd'.repeat(40);
  server.use(
    http.get(`${repository}/compare/${newLive}...${targetSHA}`, () =>
      HttpResponse.json({ status: 'behind', ahead_by: 0, behind_by: 3 }),
    ),
  );
  rerender(
    <NewDeploymentPopover
      {...props}
      liveDeployment={{ ...live, commitSHA: newLive }}
    />,
  );
  expect(
    await screen.findByText('3 commits behind the live deployment'),
  ).toBeVisible();
});

it('shows rollback notes and allows Deploy when comparison fails', async () => {
  server.use(
    http.get(`${repository}/compare/*`, () =>
      HttpResponse.json({ message: 'Not found' }, { status: 404 }),
    ),
  );
  render(<NewDeploymentPopover {...props} />);
  await openPopover();
  expect(
    await screen.findByText("Couldn't compare with the live deployment"),
  ).toBeVisible();
  expect(
    screen.getByText('Database migrations are not rolled back.'),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled();
});

it.each([
  { name: 'nothing live', liveDeployment: null },
  { name: 'the same SHA', liveDeployment: { ...live, commitSHA: targetSHA } },
])('omits comparison with $name', async ({ liveDeployment }) => {
  render(<NewDeploymentPopover {...props} liveDeployment={liveDeployment} />);
  await openPopover();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
  );
  expect(
    screen.queryByText(/commits ahead|commits behind/),
  ).not.toBeInTheDocument();
  expect(gitPaths.filter((path) => path.includes('/compare/'))).toEqual([]);
});

it('schedules the full SHA and metadata, then closes', async () => {
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Deploy' }));
  await waitFor(() =>
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument(),
  );
  expect(requests[0].object.input).toEqual({
    name: 'nhost-backend-build',
    app_id: '1',
    commit_sha: targetSHA,
    commit_message: 'Add reactions',
    commit_user_name: 'author',
    commit_user_avatar_url: null,
  });
});

it('keeps the popover open after an insert failure', async () => {
  server.use(
    http.post(endpoint, async ({ request }) => {
      const body = (await request.clone().json()) as { operationName: string };
      return body.operationName === 'InsertPipelineRun'
        ? HttpResponse.json({ errors: [{ message: 'Insert failed' }] })
        : undefined;
    }),
  );
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Deploy' }));
  expect(await screen.findByText('Insert failed')).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toHaveValue('main');
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled();
});

it('disables Deploy when a deployment starts while open', async () => {
  const { rerender } = render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
  );
  rerender(<NewDeploymentPopover {...props} inProgress />);
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Deploy' }));
  expect(requests).toEqual([]);
});

it('clears the old target immediately and ignores a late response after typing', async () => {
  const old = deferred();
  const started = deferred();
  server.use(
    http.get(`${repository}/commits/old`, async () => {
      started.resolve();
      await old.promise;
      return HttpResponse.json(commitResponse('c'.repeat(40), 'Stale target'));
    }),
  );
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await screen.findByText('Add reactions');
  await typeRef(user, 'old');
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
  await started.promise;
  await typeRef(user, 'new');
  old.resolve();
  expect(await screen.findByText('Add reactions')).toBeVisible();
  expect(screen.queryByText('Stale target')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Deploy' }));
  await waitFor(() =>
    expect(requests[0]?.object.input.commit_sha).toBe(targetSHA),
  );
});

it('never deploys when Enter is pressed in the input', async () => {
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('combobox'));
  await user.keyboard('{Enter}');
  expect(requests).toEqual([]);
  expect(screen.getByRole('combobox')).toBeVisible();
});

it('shows a skeleton instead of the input while checking GitHub access', async () => {
  const repositoryCheck = deferred();
  server.use(
    http.get(repository, async () => {
      await repositoryCheck.promise;
      return HttpResponse.json({ full_name: 'test/git-project' });
    }),
  );
  render(<NewDeploymentPopover {...props} />);
  await openPopover();
  expect(await screen.findByText('Loading...')).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  repositoryCheck.resolve();
  expect(await screen.findByRole('combobox')).toBeEnabled();
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
});

it('says once that nothing matches a search', async () => {
  const search = deferred();
  server.use(
    http.post(endpoint, async ({ request }) => {
      const { operationName } = (await request.clone().json()) as {
        operationName: string;
      };
      if (operationName !== 'searchUnifiedDeployments') {
        return undefined;
      }
      await search.promise;
      return HttpResponse.json({ data: { unifiedDeployments: [] } });
    }),
    http.get(`${repository}/commits/nomatch`, () =>
      HttpResponse.json({ message: 'Not found' }, { status: 404 }),
    ),
  );
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await screen.findByText('2 commits ahead of the live deployment');
  await typeRef(user, 'nomatch');
  expect(await screen.findByText('Searching...')).toBeVisible();
  expect(screen.queryByText(/No matches/)).not.toBeInTheDocument();

  search.resolve();
  expect(await screen.findByText('No matches for "nomatch"')).toBeVisible();
  expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
  expect(screen.queryByText('Deployed before')).not.toBeInTheDocument();
  expect(
    screen.queryByText('No branch, tag or commit matches'),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
});

it.each([404, 422])('keeps access when a ref returns %s', async (status) => {
  server.use(
    http.get(`${repository}/commits/*`, () =>
      HttpResponse.json({ message: 'Invalid ref' }, { status }),
    ),
  );
  render(<NewDeploymentPopover {...props} />);
  await openPopover();
  expect(
    await screen.findByText('No branch, tag or commit matches'),
  ).toBeVisible();
  expect(screen.getByRole('combobox')).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: 'Sign in' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
});

it.each([
  { path: '', status: 404 },
  { path: '', status: 403 },
  { path: '', status: 401 },
  { path: '/commits/*', status: 401 },
  { path: '/compare/*', status: 401 },
])('offers sign-in after $path returns $status', async ({ path, status }) => {
  server.use(
    http.get(`${repository}${path}`, () =>
      HttpResponse.json({ message: 'No access' }, { status }),
    ),
  );
  render(<NewDeploymentPopover {...props} />);
  await openPopover();
  expect(await screen.findByRole('button', { name: /Sign in/ })).toBeVisible();
  expect(screen.getByRole('combobox')).toHaveValue('');
  expect(screen.queryByText('Add reactions')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
});

it.each(['', '/commits/*', '/compare/*'])(
  'shows unavailable without Sign in when %s is rate limited',
  async (path) => {
    server.use(
      http.get(`${repository}${path}`, () =>
        HttpResponse.json(
          { message: 'Rate limit exceeded' },
          { status: 403, headers: { 'x-ratelimit-remaining': '0' } },
        ),
      ),
    );
    render(<NewDeploymentPopover {...props} />);
    await openPopover();
    expect(
      await screen.findByText('GitHub is unavailable right now'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Sign in/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
  },
);

it('offers recent deduplicated history and sign-in without a stored token', async () => {
  localStorage.removeItem(storageKey);
  render(<NewDeploymentPopover {...props} />);
  await openPopover();
  expect(await screen.findByRole('button', { name: /Sign in/ })).toBeVisible();
  expect(screen.getByRole('combobox')).toHaveValue('');
  expect(screen.getByRole('combobox')).toBeEnabled();
  expect(await screen.findByText('Deployed before')).toBeVisible();
  expect(
    await screen.findByRole('option', { name: /Stored comments update/ }),
  ).toBeVisible();
  expect(
    screen.getAllByRole('option', { name: /Stored comments update/ }),
  ).toHaveLength(1);
  expect(
    screen.getByRole('option', { name: /Live commit Live/ }),
  ).toBeVisible();
  expect(
    screen.getByText(
      'Sign in with GitHub to also find branches, tags and commits that were never deployed.',
    ),
  ).toBeVisible();
  expect(gitPaths).toEqual([]);
});

describe.each([
  {
    activation: 'click',
    activate: (user: TestUserEvent, button: HTMLElement) => user.click(button),
  },
  {
    activation: 'Enter',
    activate: async (user: TestUserEvent, button: HTMLElement) => {
      button.focus();
      await user.keyboard('{Enter}');
    },
  },
])('Sign in activated with $activation', ({ activate }) => {
  it.each([
    { linked: false, connect: true, signinProvider: null },
    { linked: true, connect: false, signinProvider: 'github' },
  ])(
    'returns to deployments using the correct auth flow (linked: $linked)',
    async ({ linked, connect, signinProvider }) => {
      localStorage.removeItem(storageKey);
      const browserWindow = Object.create(window) as Window;
      Object.defineProperty(browserWindow, 'location', {
        value: {
          href: '',
          origin: window.location.origin,
          protocol: window.location.protocol,
          hostname: window.location.hostname,
          port: window.location.port,
        },
      });
      vi.stubGlobal('window', browserWindow);
      server.use(
        http.post(endpoint, async ({ request }) => {
          const body = (await request.clone().json()) as {
            operationName: string;
          };
          return body.operationName === 'getAuthUserProviders'
            ? HttpResponse.json({
                data: {
                  authUserProviders: linked
                    ? [{ id: 'github-provider', providerId: 'github' }]
                    : [],
                },
              })
            : undefined;
        }),
      );
      render(<NewDeploymentPopover {...props} />);
      const user = await openPopover();
      await activate(
        user,
        await screen.findByRole('button', { name: /Sign in/ }),
      );
      await waitFor(() => expect(window.location.href).not.toBe(''));
      const url = new URL(window.location.href);
      expect(url.pathname).toBe('/v1/signin/provider/github');
      expect(url.searchParams.has('connect')).toBe(connect);
      const redirect = new URL(url.searchParams.get('redirectTo') ?? '');
      expect(redirect.origin).toBe(window.location.origin);
      expect(redirect.pathname).toBe(
        '/orgs/xyz/projects/test-project/deployments',
      );
      expect(redirect.searchParams.get('signinProvider')).toBe(signinProvider);
    },
  );
});

it('aborts an in-flight request on close and resolves a fresh branch head on reopen', async () => {
  let aborted = false;
  const pending = deferred();
  const started = deferred();
  server.use(
    http.get(`${repository}/commits/main`, async ({ request }) => {
      request.signal.addEventListener('abort', () => {
        aborted = true;
        pending.resolve();
      });
      started.resolve();
      await pending.promise;
      return HttpResponse.json(commitResponse());
    }),
  );
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await started.promise;
  await user.keyboard('{Escape}');
  await waitFor(() => expect(aborted).toBe(true));
  server.use(
    http.get(`${repository}/commits/main`, () =>
      HttpResponse.json(commitResponse('c'.repeat(40), 'Fresh head')),
    ),
  );
  await openPopover();
  expect(await screen.findByText('Fresh head')).toBeVisible();
  expect(screen.queryByText('Add reactions')).not.toBeInTheDocument();
  expect(
    gitPaths.filter((path) => path === '/repos/test/git-project'),
  ).toHaveLength(2);
});

it('reuses successful ref resolutions during one open', async () => {
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await screen.findByText('2 commits ahead of the live deployment');
  await typeRef(user, 'feed');
  await waitFor(() =>
    expect(gitPaths).toContain('/repos/test/git-project/commits/feed'),
  );
  await typeRef(user, 'main');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
  );
  expect(
    gitPaths.filter((path) => path.endsWith('/commits/main')),
  ).toHaveLength(1);
});

it('refetches a previously resolved branch head after closing and reopening', async () => {
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await screen.findByText('2 commits ahead of the live deployment');
  await user.keyboard('{Escape}');
  server.use(
    http.get(`${repository}/commits/main`, () =>
      HttpResponse.json(commitResponse('c'.repeat(40), 'Updated branch head')),
    ),
  );
  await openPopover();
  expect(await screen.findByText('Updated branch head')).toBeVisible();
  expect(screen.queryByText('Add reactions')).not.toBeInTheDocument();
  expect(
    gitPaths.filter((path) => path === '/repos/test/git-project'),
  ).toHaveLength(2);
});

it('does not deploy a ref containing whitespace or a non-full SHA response', async () => {
  server.use(
    http.get(`${repository}/commits/main`, () =>
      HttpResponse.json(commitResponse('abc1234')),
    ),
  );
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await waitFor(() =>
    expect(screen.queryByText('Resolving commit...')).not.toBeInTheDocument(),
  );
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
  await typeRef(user, 'two words');
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Deploy' }));
  expect(requests).toEqual([]);
});

it.each([
  { input: 'comments', messagePattern: '%comments%', shaPattern: 'comments%' },
  { input: 'cccc', messagePattern: '%cccc%', shaPattern: 'cccc%' },
  { input: '%_\\', messagePattern: '%\\%\\_\\\\%', shaPattern: '\\%\\_\\\\%' },
])(
  'searches history for "$input" with literal patterns',
  async ({ input, messagePattern, shaPattern }) => {
    localStorage.removeItem(storageKey);
    const searches: SearchUnifiedDeploymentsQueryVariables[] = [];
    server.use(
      http.post(endpoint, async ({ request }) => {
        const body = (await request.clone().json()) as {
          operationName: string;
          variables: SearchUnifiedDeploymentsQueryVariables;
        };
        if (body.operationName !== 'searchUnifiedDeployments') {
          return undefined;
        }
        searches.push(body.variables);
        return HttpResponse.json({ data: { unifiedDeployments: [stored] } });
      }),
    );
    render(<NewDeploymentPopover {...props} />);
    const user = await openPopover();
    await screen.findByRole('button', { name: /Sign in/ });
    await typeRef(user, input);
    expect(
      await screen.findByRole('option', { name: /Stored comments update/ }),
    ).toBeVisible();
    expect(searches).toEqual([
      { appId: '1', messagePattern, shaPattern, limit: 50 },
    ]);
    expect(
      screen.queryByRole('option', { name: /Live commit/ }),
    ).not.toBeInTheDocument();
    expect(gitPaths).toEqual([]);
  },
);

it('picks a stored full SHA without GitHub access and schedules its metadata', async () => {
  localStorage.removeItem(storageKey);
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await screen.findByRole('button', { name: /Sign in/ });
  await user.click(
    await screen.findByRole('option', { name: /Stored comments update/ }),
  );
  expect(screen.getByRole('combobox')).toHaveValue(stored.commitSHA);
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled();
  expect(screen.getByText('Older than the live deployment')).toBeVisible();
  expect(
    screen.getByText(
      "This commit's metadata, settings and functions replace the current ones.",
    ),
  ).toBeVisible();
  expect(
    screen.getByText('Database migrations are not rolled back.'),
  ).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Deploy' }));
  await waitFor(() =>
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument(),
  );
  expect(requests[0].object.input).toEqual({
    name: 'nhost-backend-build',
    app_id: '1',
    commit_sha: stored.commitSHA,
    commit_message: stored.commitMessage,
    commit_user_name: stored.commitUserName,
    commit_user_avatar_url: stored.commitUserAvatarUrl,
  });
  expect(gitPaths).toEqual([]);
});

it('keeps stored nullable metadata unchanged in the scheduling request', async () => {
  localStorage.removeItem(storageKey);
  server.use(
    http.post(endpoint, async ({ request }) => {
      const body = (await request.clone().json()) as { operationName: string };
      return body.operationName === 'getUnifiedDeploymentsSub'
        ? HttpResponse.json({
            data: {
              unifiedDeployments: [
                {
                  ...stored,
                  commitMessage: null,
                  commitUserName: null,
                  commitUserAvatarUrl: null,
                },
              ],
            },
          })
        : undefined;
    }),
  );
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await screen.findByRole('button', { name: /Sign in/ });
  await user.click(
    await screen.findByRole('option', { name: /No commit message/ }),
  );
  await user.click(screen.getByRole('button', { name: 'Deploy' }));
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].object.input).toMatchObject({
    commit_sha: stored.commitSHA,
    commit_message: null,
    commit_user_name: null,
    commit_user_avatar_url: null,
  });
});

it('does not warn about an older history row sharing the live SHA', async () => {
  localStorage.removeItem(storageKey);
  render(
    <NewDeploymentPopover
      {...props}
      liveDeployment={{ ...live, commitSHA: stored.commitSHA }}
    />,
  );
  const user = await openPopover();
  await screen.findByRole('button', { name: /Sign in/ });
  await user.click(
    await screen.findByRole('option', { name: /Stored comments update/ }),
  );
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled();
  expect(
    screen.queryByText('Older than the live deployment'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText('Database migrations are not rolled back.'),
  ).not.toBeInTheDocument();
});

it('cannot deploy a stored non-SHA ref without GitHub access', async () => {
  localStorage.removeItem(storageKey);
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await screen.findByRole('button', { name: /Sign in/ });
  await user.click(await screen.findByRole('option', { name: /Stored ref/ }));
  expect(screen.getByRole('combobox')).toHaveValue('release');
  expect(
    screen.getByText('Sign in with GitHub to deploy this ref'),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Deploy' }));
  expect(requests).toEqual([]);
});

it('clears a stored target immediately when the user types', async () => {
  localStorage.removeItem(storageKey);
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await screen.findByRole('button', { name: /Sign in/ });
  await user.click(
    await screen.findByRole('option', { name: /Stored comments update/ }),
  );
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled();
  await typeRef(user, 'comments');
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
  expect(
    screen.queryByText('Older than the live deployment'),
  ).not.toBeInTheDocument();
});

it('offers deployable history and search when GitHub is rate limited', async () => {
  server.use(
    http.get(repository, () =>
      HttpResponse.json({ message: 'Rate limit exceeded' }, { status: 429 }),
    ),
  );
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await screen.findByText('GitHub is unavailable right now');
  expect(screen.getByRole('combobox')).toHaveValue('');
  expect(screen.getByRole('combobox')).toBeEnabled();
  await user.click(
    await screen.findByRole('option', { name: /Stored comments update/ }),
  );
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: /Sign in/ }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Deploy' }));
  await waitFor(() =>
    expect(requests[0]?.object.input.commit_sha).toBe(stored.commitSHA),
  );
});

it.each([
  { ref: 'release', name: /Stored ref/ },
  { ref: 'c'.repeat(40), name: /Stored comments update/ },
])(
  'resolves a history pick $ref through GitHub when access exists',
  async ({ ref, name }) => {
    const resolution = deferred();
    server.use(
      http.post(endpoint, async ({ request }) => {
        const body = (await request.clone().json()) as {
          operationName: string;
        };
        return body.operationName === 'searchUnifiedDeployments'
          ? HttpResponse.json({ data: { unifiedDeployments: historyRows } })
          : undefined;
      }),
      http.get(`${repository}/commits/${ref}`, async () => {
        await resolution.promise;
        return HttpResponse.json(
          commitResponse('d'.repeat(40), 'Resolved stored ref'),
        );
      }),
    );
    render(<NewDeploymentPopover {...props} />);
    const user = await openPopover();
    await screen.findByText('2 commits ahead of the live deployment');
    await typeRef(user, 'stored');
    await user.click(await screen.findByRole('option', { name }));
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
    resolution.resolve();
    await screen.findByText('Resolved stored ref');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Deploy' }));
    await waitFor(() =>
      expect(requests[0]?.object.input.commit_sha).toBe('d'.repeat(40)),
    );
    expect(requests[0].object.input.commit_message).toBe('Resolved stored ref');
  },
);

describe('history searches with query network retries', () => {
  let client: ReturnType<typeof createHistoryRetryClient>;
  let searches: { pattern: string; signal: AbortSignal }[];
  let firstSearch: ReturnType<typeof deferred>;
  let nextSearch: ReturnType<typeof deferred>;

  beforeEach(() => {
    localStorage.removeItem(storageKey);
    client = createHistoryRetryClient();
    searches = [];
    firstSearch = deferred();
    nextSearch = deferred();
    server.use(
      http.post(endpoint, async ({ request }) => {
        const body = (await request.clone().json()) as {
          operationName: string;
          variables: SearchUnifiedDeploymentsQueryVariables;
        };
        if (body.operationName !== 'searchUnifiedDeployments') {
          return undefined;
        }
        const pattern = body.variables.messagePattern;
        searches.push({ pattern, signal: request.signal });
        if (searches.length === 1) {
          firstSearch.resolve();
          await new Promise<void>((resolve) => {
            request.signal.addEventListener('abort', () => resolve(), {
              once: true,
            });
          });
        }
        if (pattern === '%com%') {
          nextSearch.resolve();
        }
        return HttpResponse.json({
          data: {
            unifiedDeployments: [
              { ...stored, commitMessage: `History match for ${pattern}` },
            ],
          },
        });
      }),
    );
  });

  afterEach(() => client.stop());

  function renderWithRetries() {
    return render(
      <ApolloProvider client={client}>
        <NewDeploymentPopover {...props} />
      </ApolloProvider>,
    );
  }

  it('revisits a canceled search with a fresh request during retry backoff', async () => {
    renderWithRetries();
    const user = await openPopover();
    await screen.findByRole('button', { name: /Sign in/ });
    await typeRef(user, 'co');
    await firstSearch.promise;
    await typeRef(user, 'com');
    await nextSearch.promise;
    expect(searches[0].signal.aborted).toBe(true);
    expect(
      await screen.findByRole('option', { name: /History match for %com%/ }),
    ).toBeVisible();
    await typeRef(user, 'co');
    expect(
      await screen.findByRole('option', { name: /History match for %co%/ }),
    ).toBeVisible();
    expect(searches.map(({ pattern }) => pattern)).toEqual([
      '%co%',
      '%com%',
      '%co%',
    ]);
    expect(searches[2].signal.aborted).toBe(false);
    expect(
      screen.queryByText("Couldn't load deployment history"),
    ).not.toBeInTheDocument();
    await typeRef(user, 'com');
    expect(
      await screen.findByRole('option', { name: /History match for %com%/ }),
    ).toBeVisible();
    await typeRef(user, 'co');
    expect(
      await screen.findByRole('option', { name: /History match for %co%/ }),
    ).toBeVisible();
    expect(searches).toHaveLength(3);
  });

  it('starts a fresh search after closing and reopening during retry backoff', async () => {
    renderWithRetries();
    const user = await openPopover();
    await screen.findByRole('button', { name: /Sign in/ });
    await typeRef(user, 'co');
    await firstSearch.promise;
    await user.keyboard('{Escape}');
    await waitFor(() => expect(searches[0].signal.aborted).toBe(true));
    await openPopover();
    await screen.findByRole('button', { name: /Sign in/ });
    await typeRef(user, 'co');
    expect(
      await screen.findByRole('option', { name: /History match for %co%/ }),
    ).toBeVisible();
    expect(searches.map(({ pattern }) => pattern)).toEqual(['%co%', '%co%']);
    expect(searches[1].signal.aborted).toBe(false);
    expect(
      screen.queryByText("Couldn't load deployment history"),
    ).not.toBeInTheDocument();
  });
});

it('Enter picks the highlighted history row without deploying', async () => {
  localStorage.removeItem(storageKey);
  render(<NewDeploymentPopover {...props} />);
  const user = await openPopover();
  await screen.findByRole('button', { name: /Sign in/ });
  await screen.findByRole('option', { name: /Live commit Live/ });
  await user.click(screen.getByRole('combobox'));
  await user.keyboard('{ArrowDown}{Enter}');
  expect(screen.getByRole('combobox')).toHaveValue(stored.commitSHA);
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled();
  expect(requests).toEqual([]);
});

describe('GitHub suggestions', () => {
  const commentCommit = 'd'.repeat(40);
  const shaCommit = `c4d8${'e'.repeat(36)}`;

  beforeEach(() => {
    server.use(
      http.get(`${repository}/commits/${commentCommit}`, () =>
        HttpResponse.json(
          commitResponse(commentCommit, 'feat: add reactions to comments'),
        ),
      ),
      http.get(`${repository}/commits`, ({ request }) => {
        gitPaths.push(
          new URL(request.url).pathname + new URL(request.url).search,
        );
        return HttpResponse.json([
          commitResponse(commentCommit, 'feat: add reactions to comments'),
          commitResponse(shaCommit, 'Refactor permissions'),
        ]);
      }),
    );
  });

  it('highlights deployed-before and recent commit messages without substring branch queries', async () => {
    server.use(
      http.post(endpoint, async ({ request }) => {
        const body = (await request.clone().json()) as {
          operationName: string;
        };
        return body.operationName === 'searchUnifiedDeployments'
          ? HttpResponse.json({
              data: {
                unifiedDeployments: [
                  { ...live, commitMessage: 'feat: add comments table' },
                ],
              },
            })
          : undefined;
      }),
      http.get(`${repository}/commits/comments`, () =>
        HttpResponse.json({ message: 'Not found' }, { status: 404 }),
      ),
    );
    render(<NewDeploymentPopover {...props} />);
    const user = await openPopover();
    await screen.findByText('2 commits ahead of the live deployment');
    await typeRef(user, 'comments');
    const history = await screen.findByRole('option', {
      name: /feat: add comments table Live/,
    });
    const commit = await screen.findByRole('option', {
      name: /feat: add reactions to comments/,
    });
    expect(
      within(history).getByText('comments', { selector: 'mark' }),
    ).toBeVisible();
    expect(
      within(commit).getByText('comments', { selector: 'mark' }),
    ).toBeVisible();
    expect(screen.getByText('Commits on main')).toBeVisible();
    expect(
      screen.queryByText('No branch, tag or commit matches'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Branches')).not.toBeInTheDocument();
    expect(gitPaths).toContain(
      '/repos/test/git-project/git/matching-refs/heads/comments',
    );
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
    await user.click(commit);
    expect(screen.getByRole('combobox')).toHaveValue(commentCommit);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Deploy' }));
    await waitFor(() =>
      expect(requests[0]?.object.input.commit_sha).toBe(commentCommit),
    );
  });

  it.each([
    {
      prefix: 'feat',
      names: ['feat-one', 'feat/comments'],
      highlighted: 'feat',
    },
    {
      prefix: 'feat/',
      names: ['feat/comments', 'feat/reactions'],
      highlighted: 'feat/',
    },
  ])(
    'lists branch prefixes for "$prefix", including slash prefixes',
    async ({ prefix, names, highlighted }) => {
      server.use(
        http.get(
          `${repository}/git/matching-refs/heads/${prefix}`,
          ({ request }) => {
            gitPaths.push(new URL(request.url).pathname);
            return HttpResponse.json(
              names.map((name) => ({ ref: `refs/heads/${name}` })),
            );
          },
        ),
      );
      render(<NewDeploymentPopover {...props} />);
      const user = await openPopover();
      await screen.findByText('2 commits ahead of the live deployment');
      await typeRef(user, prefix);
      for (const name of names) {
        const option = await screen.findByRole('option', {
          name: `Branch ${name}`,
        });
        expect(
          within(option).getByText(highlighted, { selector: 'mark' }),
        ).toBeVisible();
      }
      expect(screen.getByText('Branches')).toBeVisible();
      expect(gitPaths).toContain(
        `/repos/test/git-project/git/matching-refs/heads/${prefix}`,
      );
    },
  );

  it('reuses completed prefix lookups and the branch commit list throughout an open', async () => {
    server.use(
      http.get(`${repository}/git/matching-refs/heads/*`, ({ request }) => {
        const path = new URL(request.url).pathname;
        gitPaths.push(path);
        return HttpResponse.json([
          { ref: `refs/heads/${path.split('/').at(-1)}-branch` },
        ]);
      }),
    );
    render(<NewDeploymentPopover {...props} />);
    const user = await openPopover();
    await screen.findByText('2 commits ahead of the live deployment');
    await typeRef(user, 'feat');
    await screen.findByRole('option', { name: 'Branch feat-branch' });
    await waitFor(() =>
      expect(gitPaths).toContain(
        '/repos/test/git-project/git/matching-refs/tags/feat',
      ),
    );
    await typeRef(user, 'fix');
    await screen.findByRole('option', { name: 'Branch fix-branch' });
    await typeRef(user, 'feat');
    expect(
      await screen.findByRole('option', { name: 'Branch feat-branch' }),
    ).toBeVisible();
    expect(
      gitPaths.filter((path) => path.endsWith('/heads/feat')),
    ).toHaveLength(1);
    expect(gitPaths.filter((path) => path.endsWith('/tags/feat'))).toHaveLength(
      1,
    );
    expect(gitPaths.filter((path) => path.includes('/commits?'))).toEqual([
      '/repos/test/git-project/commits?sha=main&per_page=100',
    ]);
    expect(
      gitPaths.filter(
        (path) => path.endsWith('/heads/') || path.endsWith('/tags/'),
      ),
    ).toEqual([]);
  });

  it('ranks a four-character SHA prefix before message matches, including across groups', async () => {
    server.use(
      http.post(endpoint, async ({ request }) => {
        const body = (await request.clone().json()) as {
          operationName: string;
        };
        return body.operationName === 'searchUnifiedDeployments'
          ? HttpResponse.json({
              data: {
                unifiedDeployments: [
                  { ...stored, commitMessage: 'Mention c4d8 in a message' },
                ],
              },
            })
          : undefined;
      }),
      http.get(`${repository}/commits`, () =>
        HttpResponse.json([
          commitResponse(commentCommit, 'Mention c4d8 in a recent message'),
          commitResponse(shaCommit, 'Refactor permissions'),
        ]),
      ),
    );
    render(<NewDeploymentPopover {...props} />);
    const user = await openPopover();
    await screen.findByText('2 commits ahead of the live deployment');
    await typeRef(user, 'c4d8');
    await screen.findByRole('option', { name: /Mention c4d8 in a message/ });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Refactor permissions');
    expect(
      within(options[0]).getByText('c4d8', { selector: 'mark' }),
    ).toBeVisible();
    expect(options[1]).toHaveTextContent('Mention c4d8 in a recent message');
    expect(options[2]).toHaveTextContent('Mention c4d8 in a message');
  });

  it.each([
    {
      label: 'Branch release',
      ref: 'refs/heads/release',
      sha: 'e'.repeat(40),
      message: 'Release branch',
    },
    {
      label: 'Tag release',
      ref: 'refs/tags/release',
      sha: 'f'.repeat(40),
      message: 'Annotated release commit',
    },
    {
      label: 'Branch feed',
      ref: 'refs/heads/feed',
      sha: 'b'.repeat(40),
      message: 'Feed branch',
    },
  ])(
    'resolves $label by its qualified ref and inserts its commit SHA',
    async ({ label, ref, sha, message }) => {
      server.use(
        http.get(`${repository}/git/matching-refs/heads/*`, () =>
          HttpResponse.json([{ ref: `refs/heads/${ref.split('/').at(-1)}` }]),
        ),
        http.get(`${repository}/git/matching-refs/tags/*`, () =>
          HttpResponse.json([
            {
              ref: `refs/tags/${ref.split('/').at(-1)}`,
              object: { type: 'tag', sha: '9'.repeat(40) },
            },
          ]),
        ),
        http.get(`${repository}/commits/${ref}`, ({ request }) => {
          gitPaths.push(new URL(request.url).pathname);
          return HttpResponse.json(commitResponse(sha, message));
        }),
      );
      render(<NewDeploymentPopover {...props} />);
      const user = await openPopover();
      await screen.findByText('2 commits ahead of the live deployment');
      await typeRef(user, ref.split('/').at(-1) ?? '');
      await screen.findByRole('option', {
        name: `Branch ${ref.split('/').at(-1)}`,
      });
      await screen.findByRole('option', {
        name: `Tag ${ref.split('/').at(-1)}`,
      });
      await user.click(screen.getByRole('option', { name: label }));
      expect(screen.getByRole('combobox')).toHaveValue(ref.split('/').at(-1));
      expect(await screen.findByText(message)).toBeVisible();
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
      );
      await user.click(screen.getByRole('button', { name: 'Deploy' }));
      await waitFor(() =>
        expect(requests[0]?.object.input.commit_sha).toBe(sha),
      );
      expect(requests[0].object.input.commit_message).toBe(message);
      expect(gitPaths).toContain(`/repos/test/git-project/commits/${ref}`);
    },
  );

  it('cancels stale prefix requests and ignores their late access errors', async () => {
    const started = deferred();
    const stale = deferred();
    let oldSignal: AbortSignal | undefined;
    server.use(
      http.get(
        `${repository}/git/matching-refs/heads/old`,
        async ({ request }) => {
          oldSignal = request.signal;
          started.resolve();
          await stale.promise;
          return HttpResponse.json({ message: 'No access' }, { status: 401 });
        },
      ),
      http.get(`${repository}/git/matching-refs/heads/new`, () =>
        HttpResponse.json([{ ref: 'refs/heads/new-branch' }]),
      ),
    );
    render(<NewDeploymentPopover {...props} />);
    const user = await openPopover();
    await screen.findByText('2 commits ahead of the live deployment');
    await typeRef(user, 'old');
    await started.promise;
    await typeRef(user, 'new');
    await waitFor(() => expect(oldSignal?.aborted).toBe(true));
    stale.resolve();
    expect(
      await screen.findByRole('option', { name: 'Branch new-branch' }),
    ).toBeVisible();
    expect(screen.getByRole('combobox')).toHaveValue('new');
    expect(
      screen.queryByRole('button', { name: /Sign in/ }),
    ).not.toBeInTheDocument();
  });

  it('picks a suggestion with the keyboard, enabling Deploy without inserting', async () => {
    server.use(
      http.get(`${repository}/git/matching-refs/heads/feed`, () =>
        HttpResponse.json([{ ref: 'refs/heads/feed' }]),
      ),
      http.get(`${repository}/commits/feed`, () =>
        HttpResponse.json({ message: 'Not found' }, { status: 404 }),
      ),
      http.get(`${repository}/commits/refs/heads/feed`, () =>
        HttpResponse.json(
          commitResponse(commentCommit, 'Keyboard-picked branch'),
        ),
      ),
    );
    render(<NewDeploymentPopover {...props} />);
    const user = await openPopover();
    await screen.findByText('2 commits ahead of the live deployment');
    await typeRef(user, 'feed');
    await screen.findByRole('option', { name: 'Branch feed' });
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(await screen.findByText('Keyboard-picked branch')).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
    );
    expect(requests).toEqual([]);
  });

  it('caps branch and tag groups at five suggestions each', async () => {
    server.use(
      http.get(`${repository}/git/matching-refs/heads/v`, () =>
        HttpResponse.json(
          Array.from({ length: 7 }, (_, index) => ({
            ref: `refs/heads/v${index}`,
          })),
        ),
      ),
      http.get(`${repository}/git/matching-refs/tags/v`, () =>
        HttpResponse.json(
          Array.from({ length: 7 }, (_, index) => ({
            ref: `refs/tags/v${index}`,
          })),
        ),
      ),
    );
    render(<NewDeploymentPopover {...props} />);
    const user = await openPopover();
    await screen.findByText('2 commits ahead of the live deployment');
    await typeRef(user, 'v');
    await screen.findByRole('option', { name: 'Branch v0' });
    await screen.findByRole('option', { name: 'Tag v0' });
    expect(screen.getAllByRole('option', { name: /^Branch v/ })).toHaveLength(
      5,
    );
    expect(screen.getAllByRole('option', { name: /^Tag v/ })).toHaveLength(5);
  });

  it.each([
    { path: '/commits', status: 401, copy: /Sign in with GitHub to also find/ },
    {
      path: '/git/matching-refs/heads/feat',
      status: 401,
      copy: /Sign in with GitHub to also find/,
    },
    {
      path: '/git/matching-refs/tags/feat',
      status: 401,
      copy: /Sign in with GitHub to also find/,
    },
    { path: '/commits', status: 429, copy: /GitHub is unavailable right now/ },
    {
      path: '/git/matching-refs/heads/feat',
      status: 429,
      copy: /GitHub is unavailable right now/,
    },
    {
      path: '/git/matching-refs/tags/feat',
      status: 429,
      copy: /GitHub is unavailable right now/,
    },
  ])(
    'keeps history available when suggestions $path return $status',
    async ({ path, status, copy }) => {
      server.use(
        http.get(`${repository}${path}`, () =>
          HttpResponse.json({ message: 'Unavailable' }, { status }),
        ),
      );
      render(<NewDeploymentPopover {...props} />);
      const user = await openPopover();
      await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
      await typeRef(user, 'feat');
      expect(await screen.findByText(copy)).toBeVisible();
      await user.clear(screen.getByRole('combobox'));
      expect(
        await screen.findByRole('option', { name: /Stored comments update/ }),
      ).toBeVisible();
      expect(screen.queryByText('Branches')).not.toBeInTheDocument();
      expect(screen.queryByText('Tags')).not.toBeInTheDocument();
    },
  );
});
