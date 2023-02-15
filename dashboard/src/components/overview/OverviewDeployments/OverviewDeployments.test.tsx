import { UserDataProvider } from '@/context/workspace1-context';
import type { Application } from '@/types/application';
import { ApplicationStatus } from '@/types/application';
import type { Workspace } from '@/types/workspace';
import { render, screen, waitForElementToBeRemoved } from '@/utils/testUtils';
import { vi } from 'vitest';
import OverviewDeployments from '.';

vi.mock('next/router', () => ({
  useRouter: vi.fn().mockReturnValue({
    basePath: '',
    pathname: '/test-workspace/test-application',
    route: '/[workspaceSlug]/[appSlug]',
    asPath: '/test-workspace/test-application',
    isLocaleDomain: false,
    isReady: true,
    isPreview: false,
    query: {
      workspaceSlug: 'test-workspace',
      appSlug: 'test-application',
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

const mockApplication: Application = {
  id: '1',
  name: 'Test Application',
  slug: 'test-application',
  appStates: [],
  hasuraGraphqlAdminSecret: 'nhost-admin-secret',
  subdomain: '',
  isProvisioned: true,
  region: {
    awsName: 'us-east-1',
    city: 'New York',
    countryCode: 'US',
    id: '1',
  },
  createdAt: new Date().toISOString(),
  deployments: [],
  desiredState: ApplicationStatus.Live,
  featureFlags: [],
  providersUpdated: true,
};

const mockWorkspace: Workspace = {
  id: '1',
  name: 'Test Workspace',
  slug: 'test-workspace',
  members: [],
  applications: [mockApplication],
};

afterAll(() => vi.restoreAllMocks());

test('should render an empty state when GitHub is not connected', () => {
  render(
    <UserDataProvider initialWorkspaces={[mockWorkspace]}>
      <OverviewDeployments />
    </UserDataProvider>,
  );

  expect(screen.getByText(/no deployments/i)).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /connect to github/i }),
  ).toBeInTheDocument();
});

test('should render an empty state when GitHub is connected, but there are no deployments', async () => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_ENV = 'production';

  render(
    <UserDataProvider
      initialWorkspaces={[
        {
          ...mockWorkspace,
          applications: [
            {
              ...mockApplication,
              githubRepository: { fullName: 'test/git-project' },
            },
          ],
        },
      ]}
    >
      <OverviewDeployments />
    </UserDataProvider>,
  );

  expect(screen.getByText(/^deployments$/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /view all/i })).toBeInTheDocument();

  await waitForElementToBeRemoved(() => screen.queryByRole('progressbar'));

  expect(screen.getByText(/no deployments/i)).toBeInTheDocument();
  expect(screen.getByText(/test\/git-project/i)).toBeInTheDocument();

  const editLink = screen.getByRole('link', { name: /edit/i });

  expect(editLink).toHaveAttribute(
    'href',
    '/test-workspace/test-application/settings/git',
  );
});
