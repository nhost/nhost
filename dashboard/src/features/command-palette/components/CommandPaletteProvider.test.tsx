import userEvent from '@testing-library/user-event';
import toast from 'react-hot-toast';
import { vi } from 'vitest';

import { CommandPaletteProvider } from '@/features/command-palette/components/CommandPaletteProvider';
import { mockMatchMediaValue } from '@/tests/mocks';
import {
  fireEvent,
  mockPointerEvent,
  render,
  screen,
  waitFor,
  within,
} from '@/tests/testUtils';

const push = vi.fn();
const openWindow = vi.fn();

const router = {
  query: { orgSlug: 'org-a', appSubdomain: 'project-a' } as {
    orgSlug?: string;
    appSubdomain?: string;
  },
  push,
  isReady: true,
};

const useOrgsMock = vi.fn();
const useProjectMock = vi.fn();
const useIsPlatformMock = vi.fn();

vi.mock('next/router', () => ({
  useRouter: () => router,
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

const makeProject = (name: string, subdomain: string) => ({
  id: subdomain,
  name,
  subdomain,
});

const projectA = makeProject('Project A', 'project-a');
const projectB = makeProject('Project B', 'project-b');
const projectC = makeProject('Project C', 'project-c');

const orgA = {
  id: 'org-a',
  name: 'Org A',
  slug: 'org-a',
  apps: [projectA, projectB],
};
const orgB = {
  id: 'org-b',
  name: 'Org B',
  slug: 'org-b',
  apps: [projectC],
};

const renderProvider = (children = <div>Dashboard body</div>) =>
  render(<CommandPaletteProvider>{children}</CommandPaletteProvider>);

let user: ReturnType<typeof userEvent.setup>;

const openPalette = async () => {
  await user.keyboard('{Meta>}k{/Meta}');

  return screen.findByLabelText('Search dashboard');
};

const replaceQuery = async (input: HTMLElement, query: string) => {
  await user.clear(input);
  await user.type(input, query);
};

const getScopeTrail = () => {
  const inputWrapper = screen.getByRole('combobox').parentElement;

  if (!inputWrapper) {
    return [];
  }

  return within(inputWrapper)
    .queryAllByTitle(/.+/)
    .map((crumb) => crumb.textContent);
};

const mockLocalMode = ({ configServerUrl = '' } = {}) => {
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'false';
  process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL = configServerUrl;
  useIsPlatformMock.mockReturnValue(false);
  useOrgsMock.mockReturnValue({
    orgs: [
      {
        id: 'local',
        name: 'Local',
        slug: 'local',
        apps: [makeProject('Local', 'local')],
      },
    ],
    currentOrg: { id: 'local', name: 'Local', slug: 'local', apps: [] },
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
  useProjectMock.mockReturnValue({
    project: makeProject('Local', 'local'),
    loading: false,
    error: null,
    refetch: vi.fn(),
    projectNotFound: false,
  });
  router.query = { orgSlug: 'local', appSubdomain: 'local' };
};

beforeEach(() => {
  user = userEvent.setup();
  toast.remove();
  push.mockReset();
  window.localStorage.clear();
  process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'true';
  process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
    'https://local.graphql.local.nhost.run/v1';
  router.query = { orgSlug: 'org-a', appSubdomain: 'project-a' };
  useIsPlatformMock.mockReturnValue(true);
  useOrgsMock.mockReturnValue({
    orgs: [orgA, orgB],
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
  window.open = openWindow;
  openWindow.mockReset();
  mockPointerEvent();
  window.matchMedia = vi.fn().mockImplementation(mockMatchMediaValue);
  window.requestAnimationFrame = (callback) => {
    callback(0);
    return 0;
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.scrollTo = vi.fn();
});

describe('CommandPaletteProvider', () => {
  it('opens and closes with the keyboard and Escape', async () => {
    renderProvider();

    const input = await openPalette();

    expect(input).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        screen.queryByLabelText('Search dashboard'),
      ).not.toBeInTheDocument();
    });

    await openPalette();

    const reopenedInput = await screen.findByLabelText('Search dashboard');
    expect(reopenedInput).toBeInTheDocument();

    await user.keyboard('{Meta>}k{/Meta}');

    await waitFor(() => {
      expect(
        screen.queryByLabelText('Search dashboard'),
      ).not.toBeInTheDocument();
    });
  });

  it('closes when clicking the backdrop', async () => {
    renderProvider();
    await openPalette();

    const dialog = await screen.findByRole('dialog');
    const backdrop = dialog.parentElement;
    expect(backdrop).not.toBeNull();

    fireEvent.pointerDown(backdrop as HTMLElement, {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse',
    });

    await waitFor(() => {
      expect(
        screen.queryByLabelText('Search dashboard'),
      ).not.toBeInTheDocument();
    });
  });

  it('routes page navigation shallowly and writes recent entries', async () => {
    renderProvider();
    const input = await openPalette();
    await replaceQuery(input, 'logs');

    await user.click(await screen.findByRole('option', { name: /Logs/ }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orgs/org-a/projects/project-a/logs',
        undefined,
        { shallow: true },
      );
    });
    expect(window.localStorage.getItem('command-palette-recent')).toContain(
      'project-logs',
    );
  });

  it('reaches a deep settings leaf from flat search with keyboard only', async () => {
    renderProvider();
    const input = await openPalette();

    await replaceQuery(input, 'environment variables');
    await screen.findByRole('option', { name: /Environment Variables/ });
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orgs/org-a/projects/project-a/settings/environment-variables',
        undefined,
        { shallow: true },
      );
    });
  });

  it('combines the fallback project hint with the trail on nested pages', async () => {
    router.query = { orgSlug: 'org-a' };
    useProjectMock.mockReturnValue({
      project: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
      projectNotFound: false,
    });

    renderProvider();
    const input = await openPalette();
    await replaceQuery(input, 'metadata');

    const row = await screen.findByRole('option', { name: /Metadata/ });

    expect(
      within(row).getByText('Org A / Project A (project-a)'),
    ).toBeInTheDocument();
    expect(within(row).getByText('GraphQL › Metadata')).toBeInTheDocument();
  });

  it('shows the trail on recent entries for nested pages', async () => {
    window.localStorage.setItem(
      'command-palette-recent',
      JSON.stringify([
        {
          nodeId: 'project-settings-database',
          title: 'Database',
          path: 'settings/database',
          accessedAt: 1,
          orgSlug: 'org-b',
          appSubdomain: 'project-c',
        },
      ]),
    );

    renderProvider();
    await openPalette();

    const row = await within(
      screen.getByRole('group', { name: 'Recent' }),
    ).findByRole('option', { name: /Database/ });

    expect(
      within(row).getByText('Org B / Project C (project-c)'),
    ).toBeInTheDocument();
    expect(
      within(row).getByText('Settings (Project) › Database'),
    ).toBeInTheDocument();
  });

  it('fills the scope with the org and project when drilling a feature group', async () => {
    renderProvider();
    const input = await openPalette();

    await replaceQuery(input, 'graphql');
    const row = await screen.findByRole('option', { selected: true });
    expect(row).toHaveAccessibleName(/^GraphQL/);
    await user.keyboard('{Tab}');

    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org A', 'Project A', 'GraphQL']);
    });

    await replaceQuery(input, 'metadata');
    await screen.findByRole('option', { name: /Metadata/ });
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orgs/org-a/projects/project-a/graphql/metadata',
        undefined,
        { shallow: true },
      );
    });
  });

  it('scopes feature group drills to the fallback project from an org-level page', async () => {
    window.localStorage.setItem(
      'command-palette-recent',
      JSON.stringify([
        {
          nodeId: 'project-overview',
          title: 'Overview',
          path: '',
          accessedAt: 1,
          orgSlug: 'org-b',
          appSubdomain: 'project-c',
        },
      ]),
    );
    router.query = { orgSlug: 'org-a' };
    useProjectMock.mockReturnValue({
      project: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
      projectNotFound: false,
    });

    renderProvider();
    const input = await openPalette();

    await replaceQuery(input, 'graphql');
    const row = await screen.findByRole('option', { selected: true });
    expect(row).toHaveAccessibleName(/^GraphQL/);
    await user.keyboard('{Tab}');

    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B', 'Project C', 'GraphQL']);
    });
  });

  it('keeps the dialog accessible and avoids forced transitions under reduced motion', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      ...mockMatchMediaValue(query),
      matches: query === '(prefers-reduced-motion: reduce)',
    }));

    renderProvider();
    await openPalette();

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Command palette')).toHaveClass('sr-only');
    expect(dialog).not.toHaveClass('transition', 'animate-pulse');
  });

  it('opens docs in a new tab without routing in-app', async () => {
    renderProvider();
    await openPalette();

    await user.click(await screen.findByRole('option', { name: /Docs/ }));

    await waitFor(() => {
      expect(openWindow).toHaveBeenCalledWith(
        'https://docs.nhost.io',
        '_blank',
        'noopener,noreferrer',
      );
    });
    expect(push).not.toHaveBeenCalled();
  });

  it('hides project pages when the account has no projects', async () => {
    const orgWithoutProjects = { ...orgA, apps: [] };
    router.query = { orgSlug: 'org-a' };
    useOrgsMock.mockReturnValue({
      orgs: [orgWithoutProjects],
      currentOrg: orgWithoutProjects,
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    useProjectMock.mockReturnValue({
      project: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
      projectNotFound: false,
    });

    renderProvider();
    const input = await openPalette();

    expect(screen.queryByRole('option', { name: /Overview/ })).toBeNull();
    expect(screen.getByRole('option', { name: /Docs/ })).toBeInTheDocument();

    await replaceQuery(input, 'logs');

    expect(screen.queryByRole('option', { name: /Logs/ })).toBeNull();
    expect(screen.getByText('No results for “logs”')).toBeInTheDocument();

    await replaceQuery(input, 'docs');
    await user.click(await screen.findByRole('option', { name: /Docs/ }));

    expect(openWindow).toHaveBeenCalledWith(
      'https://docs.nhost.io',
      '_blank',
      'noopener,noreferrer',
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('routes recent entries with their captured scope', async () => {
    window.localStorage.setItem(
      'command-palette-recent',
      JSON.stringify([
        {
          nodeId: 'project-overview',
          title: 'Overview',
          path: '',
          accessedAt: 1,
          orgSlug: 'org-b',
          appSubdomain: 'project-c',
        },
      ]),
    );
    router.query = { orgSlug: 'org-a', appSubdomain: 'project-a' };
    renderProvider();
    await openPalette();

    await user.click(
      await within(screen.getByRole('group', { name: 'Recent' })).findByRole(
        'option',
        { name: /Overview/ },
      ),
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orgs/org-b/projects/project-c',
        undefined,
        { shallow: false },
      );
    });
  });

  it('drops recent entries whose project no longer exists', async () => {
    window.localStorage.setItem(
      'command-palette-recent',
      JSON.stringify([
        {
          nodeId: 'project-logs',
          title: 'Logs',
          path: 'logs',
          accessedAt: 1,
          orgSlug: 'org-a',
          appSubdomain: 'deleted-project',
        },
      ]),
    );

    renderProvider();
    await openPalette();

    expect(
      await screen.findByLabelText('Search dashboard'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/deleted-project/)).not.toBeInTheDocument();
  });

  it('drops org-scoped recent entries whose organization no longer exists', async () => {
    window.localStorage.setItem(
      'command-palette-recent',
      JSON.stringify([
        {
          nodeId: 'org-settings',
          title: 'Settings (Organization)',
          path: 'settings',
          accessedAt: 1,
          orgSlug: 'deleted-org',
        },
      ]),
    );

    renderProvider();
    await openPalette();

    expect(
      await screen.findByLabelText('Search dashboard'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: 'Recent' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('deleted-org')).not.toBeInTheDocument();
  });

  it('finds projects and orgs by typed query from an org-level page', async () => {
    router.query = { orgSlug: 'org-a' };
    useProjectMock.mockReturnValue({
      project: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
      projectNotFound: false,
    });

    renderProvider();
    const input = await openPalette();
    await replaceQuery(input, 'Project C');

    await user.click(await screen.findByRole('option', { name: /Project C/ }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orgs/org-b/projects/project-c',
        undefined,
        { shallow: false },
      );
    });
  });

  it('keeps the current project selectable from its own pages', async () => {
    renderProvider();
    await openPalette();

    await user.click(await screen.findByRole('option', { name: /Project A/ }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orgs/org-a/projects/project-a',
        undefined,
        { shallow: true },
      );
    });
  });

  it('hides switch and gated nodes off-platform', async () => {
    mockLocalMode();

    renderProvider();
    await openPalette();

    expect(
      await screen.findByLabelText('Search dashboard'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Organizations & Projects'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Deployments')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings (Project)')).not.toBeInTheDocument();
    expect(screen.queryByText('AI')).not.toBeInTheDocument();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('shows project settings and AI off-platform when config server is set', async () => {
    mockLocalMode({
      configServerUrl: 'https://local.graphql.local.nhost.run/v1',
    });

    renderProvider();
    await openPalette();

    expect(
      await screen.findByLabelText('Search dashboard'),
    ).toBeInTheDocument();
    expect(screen.getByText('Settings (Project)')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('omits org and project hints on recent entries off-platform', async () => {
    mockLocalMode();
    window.localStorage.setItem(
      'command-palette-recent',
      JSON.stringify([
        {
          nodeId: 'project-overview',
          title: 'Overview',
          path: '',
          accessedAt: 1,
          orgSlug: 'local',
          appSubdomain: 'local',
        },
      ]),
    );

    renderProvider();
    await openPalette();

    const recentRow = await within(
      screen.getByRole('group', { name: 'Recent' }),
    ).findByRole('option', { name: /Overview/ });
    expect(
      within(recentRow).queryByText('Local / Local (local)'),
    ).not.toBeInTheDocument();
  });

  it('drills org → project → page with Tab and navigates into the target project', async () => {
    renderProvider();
    const input = await openPalette();

    await replaceQuery(input, 'Org B');
    const orgRow = await screen.findByRole('option', { name: /^Org B/ });
    await waitFor(() => {
      expect(orgRow).toHaveAttribute('aria-selected', 'true');
    });
    await user.keyboard('{Tab}');

    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B']);
    });

    await replaceQuery(input, 'Project C');
    const projectRow = await screen.findByRole('option', { name: /Project C/ });
    await waitFor(() => {
      expect(projectRow).toHaveAttribute('aria-selected', 'true');
    });
    await user.keyboard('{Tab}');

    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B', 'Project C']);
    });

    await replaceQuery(input, 'database');
    const databaseRow = await screen.findByRole('option', { selected: true });
    expect(databaseRow).toHaveAccessibleName('Database');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orgs/org-b/projects/project-c/database/browser/default',
        undefined,
        { shallow: false },
      );
    });

    const stored = JSON.parse(
      window.localStorage.getItem('command-palette-recent') ?? '[]',
    );
    expect(stored[0]).toMatchObject({
      nodeId: 'project-database',
      orgSlug: 'org-b',
      appSubdomain: 'project-c',
    });
  });

  it('scopes the organization automatically when drilling a project from the root', async () => {
    renderProvider();
    const input = await openPalette();

    await replaceQuery(input, 'Project C');
    const projectRow = await screen.findByRole('option', { name: /Project C/ });
    await waitFor(() => {
      expect(projectRow).toHaveAttribute('aria-selected', 'true');
    });
    await user.keyboard('{Tab}');

    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B', 'Project C']);
    });

    await user.keyboard('{Backspace}');

    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B']);
    });
  });

  it('pops back to a clicked ancestor crumb and drops the deeper scopes', async () => {
    renderProvider();
    const input = await openPalette();

    await replaceQuery(input, 'Org B');
    const orgRow = await screen.findByRole('option', { name: /^Org B/ });
    await waitFor(() => {
      expect(orgRow).toHaveAttribute('aria-selected', 'true');
    });
    await user.keyboard('{Tab}');
    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B']);
    });

    await replaceQuery(input, 'Project C');
    const projectRow = await screen.findByRole('option', { name: /Project C/ });
    await waitFor(() => {
      expect(projectRow).toHaveAttribute('aria-selected', 'true');
    });
    await user.keyboard('{Tab}');
    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B', 'Project C']);
    });

    await user.click(
      screen.getByRole('button', { name: /go back to org b scope/i }),
    );

    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B']);
    });
    // The remaining innermost crumb is plain text, not a button.
    expect(
      screen.queryByRole('button', { name: /go back to org b scope/i }),
    ).not.toBeInTheDocument();
  });

  it('resolves project pages to the last-visited project from an org-level page', async () => {
    window.localStorage.setItem(
      'command-palette-recent',
      JSON.stringify([
        {
          nodeId: 'project-overview',
          title: 'Overview',
          path: '',
          accessedAt: 1,
          orgSlug: 'org-b',
          appSubdomain: 'project-c',
        },
      ]),
    );
    router.query = { orgSlug: 'org-a' };
    useProjectMock.mockReturnValue({
      project: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
      projectNotFound: false,
    });

    renderProvider();
    const input = await openPalette();
    await replaceQuery(input, 'logs');

    const row = await screen.findByRole('option', { name: /Logs/ });
    expect(
      within(row).getByText('Org B / Project C (project-c)'),
    ).toBeInTheDocument();

    await user.click(row);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orgs/org-b/projects/project-c/logs',
        undefined,
        { shallow: false },
      );
    });
  });

  it('ranks matches by context affinity within a score band', async () => {
    router.query = { orgSlug: 'org-b', appSubdomain: 'project-c' };
    useProjectMock.mockReturnValue({
      project: projectC,
      loading: false,
      error: null,
      refetch: vi.fn(),
      projectNotFound: false,
    });

    renderProvider();
    const input = await openPalette();
    await replaceQuery(input, 'project');

    await screen.findByRole('option', { name: /Project C/ });

    const projectGroup = screen.getByRole('group', { name: 'Projects' });
    const rows = within(projectGroup).getAllByRole('option');

    expect(rows[0]).toHaveAccessibleName(/^ProjectC/);
    expect(rows[1]).toHaveAccessibleName(/^ProjectA/);
    expect(rows[2]).toHaveAccessibleName(/^ProjectB/);
  });

  it('stores org-scoped recents without a project subdomain', async () => {
    renderProvider();
    const input = await openPalette();
    await replaceQuery(input, 'organization settings');

    const orgSettings = await screen.findByRole('option', { selected: true });
    expect(orgSettings).toHaveAccessibleName(/^Settings\(Organization\)/);
    await user.click(orgSettings);

    await waitFor(() => {
      expect(push).toHaveBeenCalled();
    });

    const stored = JSON.parse(
      window.localStorage.getItem('command-palette-recent') ?? '[]',
    );

    expect(stored).toEqual([
      expect.objectContaining({
        nodeId: 'org-settings',
        title: 'Settings (Organization)',
        orgSlug: 'org-a',
      }),
    ]);
    expect(stored[0].appSubdomain).toBeUndefined();
  });
});
