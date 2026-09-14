import { renderToString } from 'react-dom/server';
import { vi } from 'vitest';

import Header, { type HeaderProps } from '@/components/layout/Header/Header';
import { openCreateOrgDialog } from '@/features/orgs/components/CreateOrgFormDialog/createOrgDialogStore';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  act,
  mockScrollIntoViewAndPointerCapture,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

const push = vi.fn();
const router = {
  query: { orgSlug: 'org-a', appSubdomain: 'project-a' } as {
    orgSlug?: string;
    appSubdomain?: string;
  },
  asPath: '/orgs/org-a/projects/project-a',
  pathname: '/orgs/[orgSlug]/projects/[appSubdomain]',
  route: '/orgs/[orgSlug]/projects/[appSubdomain]',
  push,
  isReady: true,
  events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
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

vi.mock('@/components/layout/Header/HeaderNavigation', () => ({
  default: () => <nav>Header navigation</nav>,
}));

const inboxMocks = vi.hoisted(() => {
  const inbox = {
    invites: [],
    invitesLoading: false,
    announcements: [],
    announcementsLoading: false,
    pendingOrganizationRequest: null,
    hasUnread: false,
  };

  return {
    inbox,
    useInbox: vi.fn(() => inbox),
    InboxPopover: vi.fn((_props: { inbox: unknown }) => null),
    InboxPopoverTrigger: vi.fn(() => <button type="button">Inbox</button>),
  };
});

vi.mock('@/features/orgs/components/members/components/InboxPopover', () => ({
  InboxPopover: inboxMocks.InboxPopover,
  InboxPopoverTrigger: inboxMocks.InboxPopoverTrigger,
  useInbox: inboxMocks.useInbox,
}));

const createOrgDialogMocks = vi.hoisted(() => ({ mount: vi.fn() }));

vi.mock('@/features/orgs/components/CreateOrgFormDialog', async () => {
  const { useEffect } = await import('react');

  return {
    CreateOrgFormDialog: ({ isOpen }: { isOpen: boolean }) => {
      useEffect(() => {
        createOrgDialogMocks.mount();
      }, []);

      return isOpen ? (
        <div role="dialog" aria-label="New Organization" />
      ) : null;
    },
  };
});

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
  appStates: [],
};
const orgA = {
  id: 'org-a',
  name: 'Org A',
  slug: 'org-a',
  apps: [projectA],
  plan: { isFree: true },
};

// `md` is 768px and `lg` 1024px, so the tablet width matches `md` only.
const viewportWidths = { mobile: 375, tablet: 800, desktop: 1280 };

type MediaQueryListener = (event: { matches: boolean }) => void;
let mediaQueryListeners: { minWidth: number; listener: MediaQueryListener }[] =
  [];

const mockViewport = (viewport: keyof typeof viewportWidths) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const minWidth = Number.parseInt(
      query.match(/min-width: (\d+)px/)?.[1] ?? '0',
      10,
    );

    return {
      ...mockMatchMediaValue(query),
      matches: viewportWidths[viewport] >= minWidth,
      addEventListener: (_type: string, listener: MediaQueryListener) => {
        mediaQueryListeners.push({ minWidth, listener });
      },
    };
  });
};

// Resizes a rendered header, the way rotating a phone does.
const resizeViewport = (viewport: keyof typeof viewportWidths) => {
  mockViewport(viewport);
  act(() => {
    for (const { minWidth, listener } of mediaQueryListeners) {
      listener({ matches: viewportWidths[viewport] >= minWidth });
    }
  });
};

beforeEach(() => {
  push.mockReset();
  window.localStorage.clear();
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
    'https://local.graphql.local.nhost.run/v1';
  router.query = { orgSlug: 'org-a', appSubdomain: 'project-a' };
  router.asPath = '/orgs/org-a/projects/project-a';
  router.pathname = '/orgs/[orgSlug]/projects/[appSubdomain]';
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
  inboxMocks.useInbox.mockClear();
  inboxMocks.InboxPopover.mockClear();
  inboxMocks.InboxPopoverTrigger.mockClear();
  createOrgDialogMocks.mount.mockClear();
  mediaQueryListeners = [];
  mockViewport('desktop');
});

const renderHeader = (props: HeaderProps = {}) => render(<Header {...props} />);

mockScrollIntoViewAndPointerCapture();

describe('Header', () => {
  it.each(['desktop', 'mobile'] as const)(
    'hands its inbox state to the inbox popover on %s',
    (viewport) => {
      mockViewport(viewport);

      renderHeader();

      expect(inboxMocks.InboxPopover).toHaveBeenLastCalledWith(
        expect.objectContaining({ inbox: inboxMocks.inbox }),
        undefined,
      );
    },
  );

  it('shows the inbox bell on desktop', () => {
    renderHeader();

    expect(inboxMocks.InboxPopoverTrigger).toHaveBeenCalled();
  });

  it('opens the inbox from the account menu instead of a bell on mobile', () => {
    mockViewport('mobile');

    renderHeader();

    expect(
      screen.queryByRole('button', { name: 'Inbox' }),
    ).not.toBeInTheDocument();
  });

  it('renders the desktop layout before the viewport is known', () => {
    const html = renderToString(<Header />);

    expect(html).toContain('Header navigation');
    expect(html).not.toContain('Open navigation');
  });

  it('keeps the create organization dialog mounted when crossing `md`', () => {
    mockViewport('mobile');
    renderHeader();
    act(() => openCreateOrgDialog());
    const dialog = screen.getByRole('dialog', { name: 'New Organization' });

    resizeViewport('desktop');

    expect(screen.getByText('Header navigation')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'New Organization' })).toBe(
      dialog,
    );
    expect(createOrgDialogMocks.mount).toHaveBeenCalledTimes(1);
  });

  it('keeps an open command palette and its query when crossing `lg`', async () => {
    const user = new TestUserEvent();
    renderHeader();

    await user.click(
      screen.getByRole('button', { name: 'Open command palette' }),
    );
    const search = await screen.findByLabelText('Search dashboard');
    await user.type(search, 'data');

    resizeViewport('tablet');

    expect(screen.getByText('Header navigation')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Search dashboard')).toEqual([search]);
    expect(search).toHaveValue('data');
  });

  it('links the logo to the dashboard home', () => {
    renderHeader();

    expect(screen.getByLabelText('Dashboard')).toHaveAttribute(
      'href',
      '/orgs/org-a/projects',
    );
  });

  it('opens the command palette from the desktop header', async () => {
    const user = new TestUserEvent();

    renderHeader();

    await user.click(
      screen.getByRole('button', { name: 'Open command palette' }),
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('renders the icon trigger on mobile', () => {
    mockViewport('mobile');

    renderHeader();

    expect(
      screen.getByRole('button', { name: 'Open command palette' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Search or navigate to...'),
    ).not.toBeInTheDocument();
  });

  it('replaces the search box with the icon trigger on tablet', () => {
    mockViewport('tablet');

    renderHeader();

    expect(
      screen.getByRole('button', { name: 'Open command palette' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Search or navigate to...'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Inbox')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Help and support' }),
    ).toBeInTheDocument();
  });

  it('opens the command palette from the mobile icon trigger', async () => {
    const user = new TestUserEvent();
    mockViewport('mobile');

    renderHeader();

    await user.click(
      screen.getByRole('button', { name: 'Open command palette' }),
    );

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('opens and closes one command palette with the shortcut on mobile', async () => {
    const user = new TestUserEvent();
    mockViewport('mobile');

    renderHeader();

    await user.keyboard('{Meta>}k{/Meta}');
    expect(await screen.findAllByRole('dialog')).toHaveLength(1);

    await user.keyboard('{Meta>}k{/Meta}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('opens one command palette with the shortcut on desktop', async () => {
    const user = new TestUserEvent();

    renderHeader();

    await user.keyboard('{Meta>}k{/Meta}');

    expect(await screen.findAllByRole('dialog')).toHaveLength(1);
  });

  it('renders the navigation sheet trigger on mobile organization pages', () => {
    mockViewport('mobile');

    renderHeader();

    expect(
      screen.getByRole('button', { name: 'Open navigation' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Dashboard')).not.toBeInTheDocument();
  });

  it.each(['/account', '/support/ticket', '/orgs/verify'])(
    'keeps the logo instead of the navigation sheet on mobile at %s',
    (path) => {
      mockViewport('mobile');
      router.query = {};
      router.pathname = path;
      router.asPath = path;

      renderHeader();

      expect(
        screen.queryByRole('button', { name: 'Open navigation' }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText('Dashboard')).toHaveAttribute('href', '/');
    },
  );

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

  it('navigates to billing and opens the upgrade modal', async () => {
    const user = new TestUserEvent();

    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Upgrade' }));

    expect(push).toHaveBeenCalledWith(
      '/orgs/org-a/billing?openUpgradeModal=true',
    );
  });
});
