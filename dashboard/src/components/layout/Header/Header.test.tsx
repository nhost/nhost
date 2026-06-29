import toast from 'react-hot-toast';
import { vi } from 'vitest';

import Header from '@/components/layout/Header/Header';
import { CommandPaletteProvider } from '@/features/command-palette';
import { fireEvent, render, screen } from '@/tests/testUtils';

const push = vi.fn();
const router = {
  query: { orgSlug: 'org-a', appSubdomain: 'project-a' },
  asPath: '/orgs/org-a/projects/project-a',
  route: '/orgs/[orgSlug]/projects/[appSubdomain]',
  push,
  isReady: true,
};

const useOrgsMock = vi.fn();
const useProjectMock = vi.fn();
const useIsPlatformMock = vi.fn();

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
  process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL = 'http://config.local';
  router.query = { orgSlug: 'org-a', appSubdomain: 'project-a' };
  useIsPlatformMock.mockReturnValue(true);
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
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 0;
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('Header command palette affordance', () => {
  it('opens the command palette when clicked', async () => {
    render(
      <CommandPaletteProvider>
        <Header />
      </CommandPaletteProvider>,
    );

    fireEvent.click(screen.getAllByLabelText('Open command palette')[0]);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText('Search dashboard')).toBeInTheDocument();
  });

  it('renders a discoverable field affordance with a responsive icon-only variant', () => {
    render(
      <CommandPaletteProvider>
        <Header />
      </CommandPaletteProvider>,
    );

    expect(screen.getByText('Search…')).toBeInTheDocument();
    expect(screen.getByText('Ctrl K')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Open command palette')).toHaveLength(2);
    expect(screen.getAllByLabelText('Open command palette')[0]).toHaveClass(
      'sm:hidden',
      'motion-safe:transition-colors',
    );
  });
});
