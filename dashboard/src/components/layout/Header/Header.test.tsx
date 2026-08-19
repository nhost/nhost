import { vi } from 'vitest';

import Header, { type HeaderProps } from '@/components/layout/Header/Header';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  fireEvent,
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';

const push = vi.fn();
const router = {
  query: { orgSlug: 'org-a', appSubdomain: 'project-a' } as {
    orgSlug?: string;
    appSubdomain?: string;
  },
  asPath: '/orgs/org-a/projects/project-a',
  route: '/orgs/[orgSlug]/projects/[appSubdomain]',
  push,
  isReady: true,
};

const useCurrentOrgMock = vi.fn();
const useOrgsMock = vi.fn();
const useProjectMock = vi.fn();
const useIsPlatformMock = vi.fn();

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('@/components/layout/AccountMenu', () => ({
  AccountMenu: () => <div>Account menu</div>,
}));

vi.mock('@/components/layout/MobileNav', () => ({
  MobileNav: () => <div>Mobile nav</div>,
}));

vi.mock('@/components/layout/Header/HeaderNavigation', () => ({
  default: () => <nav>Header navigation</nav>,
}));

vi.mock('@/features/orgs/components/members/components/InboxPopover', () => ({
  InboxPopover: () => <div>Inbox</div>,
}));

vi.mock('@/features/command-palette', () => ({
  CommandPaletteTrigger: () => (
    <button type="button" aria-label="Open command palette">
      Search or navigate to...
    </button>
  ),
}));

vi.mock('@/features/orgs/projects/hooks/useCurrentOrg', () => ({
  useCurrentOrg: () => useCurrentOrgMock(),
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: () => useOrgsMock(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => useProjectMock(),
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => useIsPlatformMock(),
}));

const projectA = {
  id: 'project-a',
  name: 'Project A',
  subdomain: 'project-a',
};
const orgA = {
  id: 'org-a',
  name: 'Org A',
  slug: 'org-a',
  apps: [projectA],
  plan: { isFree: true },
};

const mockViewport = (isDesktop: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    ...mockMatchMediaValue(query),
    matches: isDesktop,
  }));
};

beforeEach(() => {
  push.mockReset();
  window.localStorage.clear();
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
    'https://local.graphql.local.nhost.run/v1';
  router.query = { orgSlug: 'org-a', appSubdomain: 'project-a' };
  useIsPlatformMock.mockReturnValue(true);
  useCurrentOrgMock.mockReturnValue({
    org: orgA,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
  useOrgsMock.mockReturnValue({
    orgs: [orgA],
    currentOrg: orgA,
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
  useProjectMock.mockReturnValue({
    project: projectA,
    loading: false,
    error: null,
    refetch: vi.fn(),
    projectNotFound: false,
  });
  mockViewport(true);
});

const renderHeader = (props: HeaderProps = {}) => render(<Header {...props} />);

mockPointerEvent();

describe('Header', () => {
  it('links the logo to the dashboard home', () => {
    renderHeader();

    expect(screen.getByLabelText('Dashboard')).toHaveAttribute(
      'href',
      '/orgs/org-a/projects',
    );
  });

  it('renders the command palette trigger on desktop', () => {
    renderHeader();

    expect(screen.getByLabelText('Open command palette')).toBeInTheDocument();
  });

  it('does not render the command palette trigger on mobile', () => {
    mockViewport(false);

    renderHeader();

    expect(
      screen.queryByLabelText('Open command palette'),
    ).not.toBeInTheDocument();
  });

  it('opens help and support resources from the header', async () => {
    const user = new TestUserEvent();

    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Help and support' }));

    expect(
      await screen.findByText('Resources to keep you shipping.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute(
      'href',
      '/support',
    );
    expect(screen.getByRole('link', { name: 'Docs' })).toHaveAttribute(
      'href',
      'https://docs.nhost.io',
    );
    expect(screen.getByRole('link', { name: 'Status' })).toHaveAttribute(
      'href',
      'https://status.nhost.io',
    );
    expect(
      screen.getByRole('link', { name: /Join us on Discord/ }),
    ).toHaveAttribute('href', 'https://discord.com/invite/9V7Qb2U');
  });

  it('navigates to billing and opens the upgrade modal', () => {
    renderHeader();

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade' }));

    expect(push).toHaveBeenCalledWith(
      '/orgs/org-a/billing?openUpgradeModal=true',
    );
  });
});
