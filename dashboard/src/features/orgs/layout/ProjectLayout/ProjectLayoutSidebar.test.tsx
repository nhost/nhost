import { useRouter } from 'next/router';
import { vi } from 'vitest';
import ProjectLayoutSidebar from '@/features/orgs/layout/ProjectLayout/ProjectLayoutSidebar';
import { render, screen } from '@/tests/testUtils';

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

const useRouterMock = vi.mocked(useRouter);

const getRouter = (asPath: string, query: Record<string, string> = {}) => ({
  basePath: '',
  pathname: asPath,
  route: asPath,
  asPath,
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  query,
  push: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
  beforePopState: vi.fn(),
  events: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
  isFallback: false,
});

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', 'https://config.local');
  window.localStorage.removeItem('project-sidebar-collapsed');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  window.localStorage.removeItem('project-sidebar-collapsed');
});

describe('ProjectLayoutSidebar', () => {
  it('renders project links from the current project route', () => {
    useRouterMock.mockReturnValue(
      getRouter('/orgs/nhost/projects/dashboard', {
        orgSlug: 'nhost',
        appSubdomain: 'dashboard',
      }),
    );

    render(<ProjectLayoutSidebar />);

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects/dashboard',
    );
    expect(screen.getByRole('link', { name: 'Agents' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects/dashboard/ai/assistants',
    );
    expect(screen.getByRole('link', { name: 'Database' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects/dashboard/database/browser/default',
    );
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects/dashboard/settings',
    );
  });

  it('marks active project routes', () => {
    useRouterMock.mockReturnValue(
      getRouter('/orgs/nhost/projects/dashboard/graphql/actions/custom-types', {
        orgSlug: 'nhost',
        appSubdomain: 'dashboard',
      }),
    );

    render(<ProjectLayoutSidebar />);

    expect(screen.getByRole('link', { name: 'GraphQL' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('falls back to the path while router query params are not ready', () => {
    useRouterMock.mockReturnValue(
      getRouter('/orgs/nhost/projects/dashboard/ai/file-stores'),
    );

    render(<ProjectLayoutSidebar />);

    expect(screen.getByRole('link', { name: 'File Stores' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects/dashboard/ai/file-stores',
    );
    expect(screen.getByRole('link', { name: 'File Stores' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('disables gated items in self-hosted mode', () => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'false');
    vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', '');
    useRouterMock.mockReturnValue(
      getRouter('/orgs/nhost/projects/dashboard/settings', {
        orgSlug: 'nhost',
        appSubdomain: 'dashboard',
      }),
    );

    render(<ProjectLayoutSidebar />);

    expect(screen.queryByRole('link', { name: 'Agents' })).toBeNull();
    expect(
      screen.getByText('Agents').closest('[aria-disabled="true"]'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Deployments' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Metrics' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Logs' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects/dashboard/logs',
    );
  });
});
