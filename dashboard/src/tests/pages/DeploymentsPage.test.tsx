import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import DeploymentsPage from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/deployments';
import {
  mockApplication,
  mockMatchMediaValue,
  mockOrganization,
} from '@/tests/mocks';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { queryClient, render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: () => ({
    query: { orgSlug: 'xyz', appSubdomain: 'test-project' },
    isReady: true,
  }),
}));

const server = setupServer(tokenQuery);

function serve(githubRepository: typeof mockApplication.githubRepository) {
  server.use(
    http.post(
      'https://local.graphql.local.nhost.run/v1',
      async ({ request }) => {
        const { operationName } = (await request.json()) as {
          operationName: string;
        };
        switch (operationName) {
          case 'getProject':
            return HttpResponse.json({
              data: { apps: [{ ...mockApplication, githubRepository }] },
            });
          case 'getOrganization':
            return HttpResponse.json({
              data: { organizations: [mockOrganization] },
            });
          case 'getUnifiedDeploymentsSub':
          case 'LatestLiveUnifiedDeploymentSub':
          case 'PendingOrRunningUnifiedDeploymentsSub':
            return HttpResponse.json({ data: { unifiedDeployments: [] } });
          default:
            return HttpResponse.json({ data: {} });
        }
      },
    ),
  );
}

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
});
afterEach(() => {
  server.resetHandlers();
  queryClient.clear();
});
afterAll(() => server.close());

it('offers New deployment for a connected repository', async () => {
  serve(mockApplication.githubRepository);
  render(<DeploymentsPage />);

  expect(
    await screen.findByRole('button', { name: /New deployment/ }),
  ).toBeEnabled();
});

it('offers to connect GitHub instead without a repository', async () => {
  serve(null);
  render(<DeploymentsPage />);

  expect(
    await screen.findByRole('link', { name: 'Connect your Project to GitHub' }),
  ).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /New deployment/ }),
  ).not.toBeInTheDocument();
});
