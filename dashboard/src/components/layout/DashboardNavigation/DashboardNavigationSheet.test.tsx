import { useRouter } from 'next/router';
import { vi } from 'vitest';
import DashboardNavigationSheet from '@/components/layout/DashboardNavigation/DashboardNavigationSheet';
import { mockRouter } from '@/tests/mocks';
import { act, render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';

const useOrgsMock = vi.hoisted(() => vi.fn());
const useProjectMock = vi.hoisted(() => vi.fn());

vi.mock('next/router', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/features/orgs/projects/hooks/useOrgs', () => ({
  useOrgs: () => useOrgsMock(),
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: () => useProjectMock(),
}));

const events = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};

function goToOrganizationPage() {
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    pathname: '/orgs/[orgSlug]/projects',
    route: '/orgs/[orgSlug]/projects',
    asPath: '/orgs/nhost/projects',
    query: { orgSlug: 'nhost' },
    events,
  });
}

function goToProjectPage() {
  vi.mocked(useRouter).mockReturnValue({
    ...mockRouter,
    pathname: '/orgs/[orgSlug]/projects/[appSubdomain]',
    route: '/orgs/[orgSlug]/projects/[appSubdomain]',
    asPath: '/orgs/nhost/projects/my-project',
    query: { orgSlug: 'nhost', appSubdomain: 'my-project' },
    events,
  });
}

async function openSheet(user: TestUserEvent) {
  await user.click(screen.getByRole('button', { name: 'Open navigation' }));
  return screen.findByRole('dialog');
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_NHOST_PLATFORM', 'true');
  vi.stubEnv('NEXT_PUBLIC_NHOST_CONFIGSERVER_URL', 'https://config.local');
  events.on.mockReset();
  events.off.mockReset();
  useOrgsMock.mockReturnValue({ currentOrg: { name: 'Nhost Org' } });
  useProjectMock.mockReturnValue({ project: { name: 'My Project' } });
  goToOrganizationPage();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('DashboardNavigationSheet', () => {
  it('opens the navigation with its labels shown', async () => {
    const user = new TestUserEvent();

    render(<DashboardNavigationSheet />);
    await openSheet(user);

    expect(
      screen.getByRole('navigation', { name: 'Organization navigation' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Projects')).not.toHaveClass('sr-only');
  });

  it('closes when a navigation starts', async () => {
    const user = new TestUserEvent();

    render(<DashboardNavigationSheet />);
    await openSheet(user);

    const [eventName, close] = events.on.mock.calls[0];
    expect(eventName).toBe('routeChangeStart');
    act(() => close());

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('stops listening for navigation when unmounted', () => {
    const { unmount } = render(<DashboardNavigationSheet />);
    const [, close] = events.on.mock.calls[0];

    unmount();

    expect(events.off).toHaveBeenCalledWith('routeChangeStart', close);
  });

  it('closes with the close button', async () => {
    const user = new TestUserEvent();

    render(<DashboardNavigationSheet />);
    await openSheet(user);
    await user.click(screen.getByRole('button', { name: 'Close navigation' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('is titled with the project name on a project page', async () => {
    const user = new TestUserEvent();
    goToProjectPage();

    render(<DashboardNavigationSheet />);
    const sheet = await openSheet(user);

    expect(sheet).toHaveAccessibleName('My Project');
  });

  it('is titled with the organization name on an organization page', async () => {
    const user = new TestUserEvent();

    render(<DashboardNavigationSheet />);
    const sheet = await openSheet(user);

    expect(sheet).toHaveAccessibleName('Nhost Org');
  });

  it('falls back to a generic title while the organization loads', async () => {
    const user = new TestUserEvent();
    useOrgsMock.mockReturnValue({ currentOrg: undefined });

    render(<DashboardNavigationSheet />);
    const sheet = await openSheet(user);

    expect(sheet).toHaveAccessibleName('Navigation');
  });
});
