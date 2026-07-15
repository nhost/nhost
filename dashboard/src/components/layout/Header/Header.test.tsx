import { vi } from 'vitest';

import Header, { type HeaderProps } from '@/components/layout/Header/Header';
import { mockMatchMediaValue } from '@/tests/mocks';
import { render, screen } from '@/tests/testUtils';

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
  push.mockReset();
  window.localStorage.clear();
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
    'https://local.graphql.local.nhost.run/v1';
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
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
});

const renderHeader = (props: HeaderProps = {}) => render(<Header {...props} />);

describe('Header command palette affordance', () => {
  it('does not render a command palette trigger', () => {
    renderHeader();

    expect(
      screen.queryByLabelText('Open command palette'),
    ).not.toBeInTheDocument();
  });
});
