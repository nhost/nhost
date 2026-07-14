import toast from 'react-hot-toast';
import { vi } from 'vitest';

import Header from '@/components/layout/Header/Header';
import { CommandPaletteProvider } from '@/features/command-palette';
import { mockMatchMediaValue } from '@/tests/mocks';
import { fireEvent, render, screen } from '@/tests/testUtils';

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

const useOrgsMock = vi.fn();
const useProjectMock = vi.fn();
const useIsPlatformMock = vi.fn();
const useTreeNavStateMock = vi.fn();

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('@/components/layout/AccountMenu', () => ({
  AccountMenu: () => <div>Account menu</div>,
}));

vi.mock('@/components/layout/LocalAccountMenu', () => ({
  LocalAccountMenu: () => <div>Local account menu</div>,
}));

vi.mock('@/components/layout/MobileNav', () => ({
  MobileNav: () => <div>Mobile nav</div>,
}));

vi.mock('@/components/layout/Header/BreadcrumbNav', () => ({
  default: () => <nav>Breadcrumbs</nav>,
}));

vi.mock('@/components/layout/MainNav/TreeNavStateContext', () => ({
  useTreeNavState: () => useTreeNavStateMock(),
}));

vi.mock(
  '@/features/orgs/components/members/components/AnnouncementsTray',
  () => ({
    AnnouncementsTray: () => <div>Announcements</div>,
  }),
);

vi.mock(
  '@/features/orgs/components/members/components/NotificationsTray',
  () => ({
    NotificationsTray: () => <div>Notifications</div>,
  }),
);

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
};

beforeEach(() => {
  toast.remove();
  push.mockReset();
  window.localStorage.clear();
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL = 'https://local.graphql.local.nhost.run/v1';
  router.query = { orgSlug: 'org-a', appSubdomain: 'project-a' };
  useIsPlatformMock.mockReturnValue(true);
  useTreeNavStateMock.mockReturnValue({ mainNavPinned: true });
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
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 0;
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const renderHeader = () =>
  render(
    <CommandPaletteProvider>
      <Header />
    </CommandPaletteProvider>,
  );

describe('Header command palette affordance', () => {
  it('opens the command palette when clicked', async () => {
    renderHeader();

    fireEvent.click(screen.getByLabelText('Open command palette'));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Search dashboard')).toBeInTheDocument();
  });

  it('renders a single icon trigger hidden on desktop while the pinned rail is visible', () => {
    renderHeader();

    const triggers = screen.getAllByLabelText('Open command palette');

    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toHaveClass('md:hidden');
    expect(screen.queryByText('Search…')).not.toBeInTheDocument();
  });

  it('keeps the icon trigger visible when the nav is unpinned', () => {
    useTreeNavStateMock.mockReturnValue({ mainNavPinned: false });

    renderHeader();

    expect(screen.getByLabelText('Open command palette')).not.toHaveClass(
      'md:hidden',
    );
  });

  it('keeps the icon trigger visible on pages without an org', () => {
    router.query = {};

    renderHeader();

    expect(screen.getByLabelText('Open command palette')).not.toHaveClass(
      'md:hidden',
    );
  });
});
