import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import { mockApplication, mockOrganization } from '@/tests/orgs/mocks';
import { queryClient, render, screen } from '@/tests/orgs/testUtils';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, vi } from 'vitest';
import OverviewDeployments from './OverviewDeployments';

vi.mock('next/router', () => ({
  useRouter: vi.fn().mockReturnValue({
    basePath: '',
    pathname: '/orgs/xyz/projects/test-project',
    route: '/orgs/[orgSlug]/projects/[appSubdomain]',
    asPath: '/orgs/xyz/projects/test-project',
    isLocaleDomain: false,
    isReady: true,
    isPreview: false,
    query: {
      orgSlug: 'xyz',
      appSubdomain: 'test-project',
    },
    push: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    beforePopState: vi.fn(),
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
    isFallback: false,
  }),
}));

const server = setupServer(
  tokenQuery,
  rest.get('https://local.graphql.nhost.run/v1', (_req, res, ctx) =>
    res(ctx.status(200)),
  ),
);

beforeAll(() => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';
  server.listen();
});

afterEach(() => {
  server.resetHandlers(
    rest.get('https://local.graphql.nhost.run/v1', (_req, res, ctx) =>
      res(ctx.status(200)),
    ),
  );
  queryClient.clear();
});

afterAll(() => {
  server.close();
  vi.restoreAllMocks();
});

test('should render an empty state when GitHub is not connected', async () => {
  server.use(
    rest.post('https://local.graphql.nhost.run/v1', async (req, res, ctx) => {
      const { operationName } = await req.json();

      if (operationName === 'getProject') {
        return res(
          ctx.json({
            apps: [{ ...mockApplication, githubRepository: null }],
          }),
        );
      }

      if (operationName === 'getOrganization') {
        return res(
          ctx.json({
            organizations: [{ ...mockOrganization }],
          }),
        );
      }

      return res(
        ctx.json({
          data: {
            deployments: [],
          },
        }),
      );
    }),
  );

  render(<OverviewDeployments />);

  expect(await screen.findByText(/no deployments/i)).toBeInTheDocument();
  expect(
    await screen.findByRole('button', { name: /connect to github/i }),
  ).toBeInTheDocument();
});

test('should render an empty state when GitHub is connected, but there are no deployments', async () => {
  server.use(
    rest.post('https://local.graphql.nhost.run/v1', async (_req, res, ctx) => {
      const { operationName } = await _req.json();

      if (operationName === 'getProject') {
        return res(
          ctx.json({
            data: {
              apps: [{ ...mockApplication }],
            },
          }),
        );
      }

      if (operationName === 'getOrganization') {
        return res(
          ctx.json({
            data: {
              organizations: [{ ...mockOrganization }],
            },
          }),
        );
      }

      return res(ctx.json({ data: { deployments: [] } }));
    }),
  );

  render(<OverviewDeployments />);

  expect(await screen.findByText(/^deployments$/i)).toBeInTheDocument();
  expect(
    await screen.findByRole('link', { name: /view all/i }),
  ).toBeInTheDocument();

  expect(await screen.findByText(/no deployments/i)).toBeInTheDocument();
  expect(await screen.findByText(/test\/git-project/i)).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: /edit/i })).toHaveAttribute(
    'href',
    '/orgs/xyz/projects/test-project/settings/git',
  );
});

test('should render a list of deployments', async () => {
  server.use(
    tokenQuery,
    rest.post('https://local.graphql.nhost.run/v1', async (_req, res, ctx) => {
      const { operationName } = await _req.json();

      if (operationName === 'ScheduledOrPendingDeploymentsSub') {
        return res(ctx.json({ data: { deployments: [] } }));
      }

      if (operationName === 'getProject') {
        return res(
          ctx.json({
            data: {
              apps: [{ ...mockApplication }],
            },
          }),
        );
      }

      if (operationName === 'getOrganization') {
        return res(
          ctx.json({
            data: {
              organizations: [{ ...mockOrganization }],
            },
          }),
        );
      }

      return res(
        ctx.json({
          data: {
            deployments: [
              {
                id: '1',
                commitSHA: 'abc123',
                deploymentStartedAt: '2021-08-01T00:00:00.000Z',
                deploymentEndedAt: '2021-08-01T00:05:00.000Z',
                deploymentStatus: 'DEPLOYED',
                commitUserName: 'test.user',
                commitUserAvatarUrl: 'http://images.example.com/avatar.png',
                commitMessage: 'Test commit message',
              },
            ],
          },
        }),
      );
    }),
  );

  render(<OverviewDeployments />);

  expect(await screen.findByText(/test commit message/i)).toBeInTheDocument();
  expect(await screen.findByLabelText(/avatar/i)).toHaveStyle(
    'background-image: url(http://images.example.com/avatar.png)',
  );
  expect(
    await screen.findByRole('link', {
      name: /test commit message/i,
    }),
  ).toHaveAttribute('href', '/orgs/xyz/projects/test-project/deployments/1');
  expect(await screen.findByText(/5m 0s/i)).toBeInTheDocument();
  expect(await screen.findByText(/live/i)).toBeInTheDocument();
  expect(
    await screen.findByRole('button', { name: /redeploy/i }),
  ).not.toBeDisabled();
});

test('should disable redeployments if a deployment is already in progress', async () => {
  server.use(
    tokenQuery,
    rest.post('https://local.graphql.nhost.run/v1', async (req, res, ctx) => {
      const { operationName } = await req.json();

      if (operationName === 'ScheduledOrPendingDeploymentsSub') {
        return res(
          ctx.json({
            data: {
              deployments: [
                {
                  id: '2',
                  commitSHA: 'abc234',
                  deploymentStartedAt: '2021-08-02T00:00:00.000Z',
                  deploymentEndedAt: null,
                  deploymentStatus: 'PENDING',
                  commitUserName: 'test.user',
                  commitUserAvatarUrl: 'http://images.example.com/avatar.png',
                  commitMessage: 'Test commit message',
                },
              ],
            },
          }),
        );
      }

      if (operationName === 'getProject') {
        return res(
          ctx.json({
            data: {
              apps: [{ ...mockApplication }],
            },
          }),
        );
      }

      if (operationName === 'getOrganization') {
        return res(
          ctx.json({
            data: {
              organizations: [{ ...mockOrganization }],
            },
          }),
        );
      }

      return res(
        ctx.json({
          data: {
            deployments: [
              {
                id: '1',
                commitSHA: 'abc123',
                deploymentStartedAt: '2021-08-01T00:00:00.000Z',
                deploymentEndedAt: '2021-08-01T00:05:00.000Z',
                deploymentStatus: 'DEPLOYED',
                commitUserName: 'test.user',
                commitUserAvatarUrl: 'http://images.example.com/avatar.png',
                commitMessage: 'Test commit message',
              },
            ],
          },
        }),
      );
    }),
  );

  render(<OverviewDeployments />);

  expect(
    await screen.findByRole('button', { name: /redeploy/i }),
  ).toBeDisabled();
});
