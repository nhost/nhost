import { HttpResponse, http } from 'msw';
import DeploymentsPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/deployments';
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
} from '@/tests/testUtils';

const { server } = await vi.hoisted(async () => {
  const { setupServer } = await import('msw/node');
  const mockServer = setupServer();
  mockServer.listen({ onUnhandledRequest: 'error' });
  return { server: mockServer };
});
const endpoint = 'https://local.graphql.local.nhost.run/v1';

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  mockScrollIntoViewAndPointerCapture();
});
beforeEach(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  server.use(tokenQuery);
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
  localStorage.removeItem('nhost_provider_tokens_github');
});
afterAll(() => server.close());

function projectHandler(connected: boolean, automaticDeploys: boolean) {
  return http.post(endpoint, async ({ request }) => {
    const { operationName } = (await request.clone().json()) as {
      operationName: string;
    };
    switch (operationName) {
      case 'getProject':
        return HttpResponse.json({
          data: {
            apps: [
              {
                ...mockApplication,
                githubRepository: connected
                  ? mockApplication.githubRepository
                  : null,
                repositoryProductionBranch: 'main',
                automaticDeploys,
              },
            ],
          },
        });
      case 'getOrganization':
        return HttpResponse.json({
          data: { organizations: [mockOrganization] },
        });
      case 'getUnifiedDeploymentsSub':
      case 'LatestLiveUnifiedDeploymentSub':
      case 'PendingOrRunningUnifiedDeploymentsSub':
        return HttpResponse.json({ data: { unifiedDeployments: [] } });
      case 'getAuthUserProviders':
        return HttpResponse.json({ data: { authUserProviders: [] } });
      default:
        return undefined;
    }
  });
}

it.each([true, false])(
  'offers New deployment with no deployments and automatic deploys %s',
  async (automaticDeploys) => {
    server.use(projectHandler(true, automaticDeploys));
    render(<DeploymentsPage />);
    expect(
      await screen.findByRole('button', { name: /New deployment/ }),
    ).toBeEnabled();
    expect(await screen.findByText('No deployments yet.')).toBeVisible();
  },
);

it('does not offer New deployment without a connected repository', async () => {
  server.use(projectHandler(false, true));
  render(<DeploymentsPage />);
  expect(
    await screen.findByRole('link', { name: 'Connect your Project to GitHub' }),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /New deployment/ }),
  ).not.toBeInTheDocument();
});

it('keeps Deploy disabled until the delayed activity response arrives', async () => {
  let release: () => void = () => {};
  const activity = new Promise<void>((resolve) => {
    release = resolve;
  });
  localStorage.setItem(
    'nhost_provider_tokens_github',
    JSON.stringify({
      authUserProviderId: 'provider',
      accessToken: 'fixture-access',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }),
  );
  server.use(
    http.post(endpoint, async ({ request }) => {
      const { operationName } = (await request.clone().json()) as {
        operationName: string;
      };
      if (operationName === 'LatestLiveUnifiedDeploymentSub') {
        await activity;
        return HttpResponse.json({ data: { unifiedDeployments: [] } });
      }
      if (operationName === 'getAuthUserProviders') {
        return HttpResponse.json({
          data: {
            authUserProviders: [{ id: 'provider', providerId: 'github' }],
          },
        });
      }
      return undefined;
    }),
    projectHandler(true, false),
    http.get('https://api.github.com/repos/test/git-project', () =>
      HttpResponse.json({ full_name: 'test/git-project' }),
    ),
    http.get('https://api.github.com/repos/test/git-project/commits/main', () =>
      HttpResponse.json({
        sha: 'b'.repeat(40),
        commit: {
          message: 'Branch head',
          author: { name: 'Author', date: null },
          committer: null,
        },
        author: null,
        committer: null,
      }),
    ),
  );
  render(<DeploymentsPage />);
  await new TestUserEvent().click(
    await screen.findByRole('button', { name: /New deployment/ }),
  );
  expect(await screen.findByText('Branch head')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Deploy' })).toBeDisabled();
  release();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Deploy' })).toBeEnabled(),
  );
});
