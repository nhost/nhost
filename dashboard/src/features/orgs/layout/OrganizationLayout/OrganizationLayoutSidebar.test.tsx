import { useRouter } from 'next/router';
import { vi } from 'vitest';
import OrganizationLayoutSidebar from '@/features/orgs/layout/OrganizationLayout/OrganizationLayoutSidebar';
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
  window.localStorage.removeItem('organization-sidebar-collapsed');
});

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.removeItem('organization-sidebar-collapsed');
});

describe('OrganizationLayoutSidebar', () => {
  it('renders organization links from the current org slug', () => {
    useRouterMock.mockReturnValue(
      getRouter('/orgs/nhost/projects', { orgSlug: 'nhost' }),
    );

    render(<OrganizationLayoutSidebar />);

    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects',
    );
    expect(screen.getByRole('link', { name: 'General' })).toHaveAttribute(
      'href',
      '/orgs/nhost/settings',
    );
    expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute(
      'href',
      '/orgs/nhost/members',
    );
    expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute(
      'href',
      '/orgs/nhost/billing',
    );
  });

  it('marks the active organization route', () => {
    useRouterMock.mockReturnValue(
      getRouter('/orgs/nhost/settings?tab=general', { orgSlug: 'nhost' }),
    );

    render(<OrganizationLayoutSidebar />);

    expect(screen.getByRole('link', { name: 'General' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Projects' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('falls back to the path while router query params are not ready', () => {
    useRouterMock.mockReturnValue(getRouter('/orgs/nhost/projects/new'));

    render(<OrganizationLayoutSidebar />);

    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/orgs/nhost/projects',
    );
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});
