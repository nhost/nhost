import HeaderNavigationSheet from '@/components/layout/Header/HeaderNavigationSheet';
import { openCreateOrgDialog } from '@/features/orgs/components/CreateOrgFormDialog/createOrgDialogStore';
import {
  mockScrollIntoViewAndPointerCapture,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';

const push = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  pathname: '',
  push,
}));
const useIsPlatformMock = vi.hoisted(() => vi.fn());
const useOrgsMock = vi.hoisted(() => vi.fn());

vi.mock('next/router', () => ({
  useRouter: () => router,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: () => useIsPlatformMock(),
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: () => useOrgsMock(),
}));

vi.mock('@/features/orgs/projects/common/hooks/useAppState', () => ({
  useAppState: () => ({ state: 1 }),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => ({
    project: { githubRepository: null, appStates: [] },
  }),
}));

vi.mock(
  '@/features/orgs/components/CreateOrgFormDialog/createOrgDialogStore',
  () => ({ openCreateOrgDialog: vi.fn() }),
);

const orgA = {
  slug: 'org-a',
  name: 'Org A',
  plan: { name: 'Starter' },
  apps: [
    { name: 'Project A', subdomain: 'project-a' },
    { name: 'Project B', subdomain: 'project-b' },
  ],
};
const orgB = {
  slug: 'org-b',
  name: 'Org B',
  plan: { name: 'Pro' },
  apps: [],
};

function goToProjectPage() {
  router.pathname = '/orgs/[orgSlug]/projects/[appSubdomain]';
  router.query = { orgSlug: 'org-a', appSubdomain: 'project-a' };
}

const sheetTriggerName = /switch organization or project$/;

async function openSheet(user: TestUserEvent) {
  await user.click(screen.getByRole('button', { name: sheetTriggerName }));
}

describe('HeaderNavigationSheet', () => {
  beforeEach(() => {
    mockScrollIntoViewAndPointerCapture();
    push.mockReset();
    window.localStorage.clear();
    router.pathname = '/orgs/[orgSlug]/projects';
    router.query = { orgSlug: 'org-a' };
    useIsPlatformMock.mockReturnValue(true);
    useOrgsMock.mockReturnValue({ orgs: [orgA, orgB], currentOrg: orgA });
    vi.mocked(openCreateOrgDialog).mockClear();
  });

  it('labels the trigger with the current project on a project page', () => {
    goToProjectPage();

    render(<HeaderNavigationSheet />);

    expect(
      screen.getByRole('button', { name: sheetTriggerName }),
    ).toHaveAccessibleName(/^Project A\b/);
  });

  it('labels the trigger with the current organization on an organization page', () => {
    render(<HeaderNavigationSheet />);

    expect(
      screen.getByRole('button', { name: sheetTriggerName }),
    ).toHaveAccessibleName(/^Org A\b/);
  });

  it('asks to select an organization when there is none', () => {
    useOrgsMock.mockReturnValue({ orgs: [orgA, orgB], currentOrg: undefined });

    render(<HeaderNavigationSheet />);

    expect(
      screen.getByRole('button', { name: sheetTriggerName }),
    ).toHaveAccessibleName(/^Select organization\b/);
  });

  it('marks the current organization and project', async () => {
    const user = new TestUserEvent();
    goToProjectPage();

    render(<HeaderNavigationSheet />);
    await openSheet(user);

    expect(screen.getByRole('button', { name: /Org A/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: /Org B/ })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('button', { name: 'Project A' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(
      screen.getByRole('button', { name: 'Project B' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('switches the organization, remembers it and closes the sheet', async () => {
    const user = new TestUserEvent();

    render(<HeaderNavigationSheet />);
    await openSheet(user);
    await user.click(screen.getByRole('button', { name: /Org B/ }));

    expect(push).toHaveBeenCalledWith('/orgs/org-b/projects');
    expect(window.localStorage.getItem('slug')).toBe('"org-b"');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('switches the project and keeps the tab', async () => {
    const user = new TestUserEvent();
    router.pathname = '/orgs/[orgSlug]/projects/[appSubdomain]/settings';
    router.query = {
      orgSlug: 'org-a',
      appSubdomain: 'project-a',
      tab: 'secrets',
    };

    render(<HeaderNavigationSheet />);
    await openSheet(user);
    await user.click(screen.getByRole('button', { name: 'Project B' }));

    expect(push).toHaveBeenCalledWith(
      '/orgs/org-a/projects/project-b/settings?tab=secrets',
    );
  });

  it('opens the new project page', async () => {
    const user = new TestUserEvent();

    render(<HeaderNavigationSheet />);
    await openSheet(user);
    await user.click(screen.getByRole('button', { name: 'New Project' }));

    expect(push).toHaveBeenCalledWith('/orgs/org-a/projects/new');
  });

  it('opens the create organization dialog', async () => {
    const user = new TestUserEvent();

    render(<HeaderNavigationSheet />);
    await openSheet(user);
    await user.click(screen.getByRole('button', { name: 'New Organization' }));

    // `Header` renders the dialog, so it survives the layout switch.
    expect(openCreateOrgDialog).toHaveBeenCalledOnce();
  });

  it('renders nothing outside the platform', () => {
    useIsPlatformMock.mockReturnValue(false);

    render(<HeaderNavigationSheet />);

    expect(
      screen.queryByRole('button', { name: sheetTriggerName }),
    ).not.toBeInTheDocument();
  });
});
