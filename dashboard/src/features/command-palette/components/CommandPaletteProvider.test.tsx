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

const openPalette = async () => {
  fireEvent.keyDown(window, { key: 'k', metaKey: true });

  return screen.findByLabelText('Search dashboard');
};

const getScopeTrail = () =>
  screen
    .queryAllByTestId('command-palette-scope-crumb')
    .map((crumb) => crumb.textContent);

beforeEach(() => {
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

    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(
        screen.queryByLabelText('Search dashboard'),
      ).not.toBeInTheDocument();
    });

    await openPalette();

    const reopenedInput = await screen.findByLabelText('Search dashboard');
    expect(reopenedInput).toBeInTheDocument();

    fireEvent.blur(reopenedInput);
    fireEvent.keyDown(window, { key: 'k', metaKey: true });

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
    fireEvent.change(input, { target: { value: 'logs' } });

    fireEvent.click(
      await screen.findByTestId('command-palette-item-project-logs'),
    );

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

    fireEvent.change(input, { target: { value: 'environment variables' } });
    await screen.findByTestId(
      'command-palette-item-project-settings-environment-variables',
    );
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orgs/org-a/projects/project-a/settings/environment-variables',
        undefined,
        { shallow: true },
      );
    });
  });

  it('reaches the same deep settings leaf by drilling with keyboard only', async () => {
    renderProvider();
    const input = await openPalette();

    fireEvent.change(input, { target: { value: 'configuration' } });
    const settingsRow = await screen.findByTestId(
      'command-palette-item-project-settings',
    );
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => {
      expect(settingsRow).toHaveAttribute('aria-selected', 'true');
    });
    (input as HTMLInputElement).setSelectionRange(
      (input as HTMLInputElement).value.length,
      (input as HTMLInputElement).value.length,
    );
    fireEvent.keyDown(input, { key: 'ArrowRight' });

    // Drilling a feature group scopes the org and project too, like the
    // breadcrumb nav.
    await waitFor(() => {
      expect(getScopeTrail()).toEqual([
        'Org A',
        'Project A',
        'Settings (Project)',
      ]);
    });

    fireEvent.change(input, { target: { value: 'environment variables' } });
    await screen.findByTestId(
      'command-palette-item-switch:project:org-a:project-a:project-settings-environment-variables',
    );
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orgs/org-a/projects/project-a/settings/environment-variables',
        undefined,
        { shallow: true },
      );
    });
  });

  it('shows breadcrumb trails on nested search results', async () => {
    renderProvider();
    const input = await openPalette();
    fireEvent.change(input, { target: { value: 'environment variables' } });

    const row = await screen.findByTestId(
      'command-palette-item-project-settings-environment-variables',
    );

    expect(
      within(row).getByText('Settings (Project) › Environment Variables'),
    ).toBeInTheDocument();
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
    fireEvent.change(input, { target: { value: 'metadata' } });

    const row = await screen.findByTestId(
      'command-palette-item-project-graphql-metadata',
    );

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

    const row = await screen.findByTestId(
      'command-palette-item-recent:project-settings-database:org-b:project-c',
    );

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

    fireEvent.change(input, { target: { value: 'graphql' } });
    const row = await screen.findByTestId(
      'command-palette-item-project-graphql',
    );
    await waitFor(() => {
      expect(row).toHaveAttribute('aria-selected', 'true');
    });
    fireEvent.keyDown(input, { key: 'Tab' });

    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org A', 'Project A', 'GraphQL']);
    });

    fireEvent.change(input, { target: { value: 'metadata' } });
    await screen.findByTestId(
      'command-palette-item-switch:project:org-a:project-a:project-graphql-metadata',
    );
    fireEvent.keyDown(input, { key: 'Enter' });

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

    fireEvent.change(input, { target: { value: 'graphql' } });
    const row = await screen.findByTestId(
      'command-palette-item-project-graphql',
    );
    await waitFor(() => {
      expect(row).toHaveAttribute('aria-selected', 'true');
    });
    fireEvent.keyDown(input, { key: 'Tab' });

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

    fireEvent.click(await screen.findByTestId('command-palette-item-docs'));

    await waitFor(() => {
      expect(openWindow).toHaveBeenCalledWith(
        'https://docs.nhost.io',
        '_blank',
        'noopener,noreferrer',
      );
    });
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

    fireEvent.click(
      await screen.findByTestId(
        'command-palette-item-recent:project-overview:org-b:project-c',
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
    expect(
      screen.queryByTestId(
        'command-palette-item-recent:project-logs:org-a:deleted-project',
      ),
    ).not.toBeInTheDocument();
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
    fireEvent.change(input, { target: { value: 'Project C' } });

    fireEvent.click(
      await screen.findByTestId(
        'command-palette-item-switch:project:org-b:project-c',
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

  it('shows organization and project names in hints while staying searchable by org slug', async () => {
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

    renderProvider();
    const input = await openPalette();

    const recentRow = await screen.findByTestId(
      'command-palette-item-recent:project-overview:org-b:project-c',
    );
    expect(
      within(recentRow).getByText('Org B / Project C (project-c)'),
    ).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'org-b' } });

    const switchRow = await screen.findByTestId(
      'command-palette-item-switch:project:org-b:project-c',
    );
    expect(
      within(switchRow).getByText('Org B / Project C (project-c)'),
    ).toBeInTheDocument();
  });

  it('switches to another project with a full navigation', async () => {
    renderProvider();
    await openPalette();

    fireEvent.click(
      await screen.findByTestId(
        'command-palette-item-switch:project:org-a:project-b',
      ),
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orgs/org-a/projects/project-b',
        undefined,
        { shallow: false },
      );
    });
  });

  it('keeps the current project selectable from its own pages', async () => {
    renderProvider();
    await openPalette();

    fireEvent.click(
      await screen.findByTestId(
        'command-palette-item-switch:project:org-a:project-a',
      ),
    );

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orgs/org-a/projects/project-a',
        undefined,
        { shallow: true },
      );
    });
  });

  it('hides switch and gated nodes off-platform', async () => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'false';
    process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL = '';
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
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('shows project settings and AI off-platform when config server is set', async () => {
    process.env.NEXT_PUBLIC_NHOST_PLATFORM = 'false';
    process.env.NEXT_PUBLIC_NHOST_CONFIGSERVER_URL =
      'https://local.graphql.local.nhost.run/v1';
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

    renderProvider();
    await openPalette();

    expect(
      await screen.findByLabelText('Search dashboard'),
    ).toBeInTheDocument();
    expect(screen.getByText('Settings (Project)')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('drills org → project → page with Tab and navigates into the target project', async () => {
    renderProvider();
    const input = await openPalette();

    fireEvent.change(input, { target: { value: 'Org B' } });
    const orgRow = await screen.findByTestId(
      'command-palette-item-switch:org:org-b',
    );
    await waitFor(() => {
      expect(orgRow).toHaveAttribute('aria-selected', 'true');
    });
    fireEvent.keyDown(input, { key: 'Tab' });

    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B']);
    });

    fireEvent.change(input, { target: { value: 'Project C' } });
    const projectRow = await screen.findByTestId(
      'command-palette-item-switch:project:org-b:project-c',
    );
    await waitFor(() => {
      expect(projectRow).toHaveAttribute('aria-selected', 'true');
    });
    fireEvent.keyDown(input, { key: 'Tab' });

    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B', 'Project C']);
    });

    fireEvent.change(input, { target: { value: 'database' } });
    const databaseRow = await screen.findByTestId(
      'command-palette-item-switch:project:org-b:project-c:project-database',
    );
    await waitFor(() => {
      expect(databaseRow).toHaveAttribute('aria-selected', 'true');
    });
    fireEvent.keyDown(input, { key: 'Enter' });

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

    fireEvent.change(input, { target: { value: 'Project C' } });
    const projectRow = await screen.findByTestId(
      'command-palette-item-switch:project:org-b:project-c',
    );
    await waitFor(() => {
      expect(projectRow).toHaveAttribute('aria-selected', 'true');
    });
    fireEvent.keyDown(input, { key: 'Tab' });

    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B', 'Project C']);
    });

    fireEvent.keyDown(input, { key: 'Backspace' });

    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B']);
    });
  });

  it('pops back to a clicked ancestor crumb and drops the deeper scopes', async () => {
    renderProvider();
    const input = await openPalette();

    fireEvent.change(input, { target: { value: 'Org B' } });
    const orgRow = await screen.findByTestId(
      'command-palette-item-switch:org:org-b',
    );
    await waitFor(() => {
      expect(orgRow).toHaveAttribute('aria-selected', 'true');
    });
    fireEvent.keyDown(input, { key: 'Tab' });
    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B']);
    });

    fireEvent.change(input, { target: { value: 'Project C' } });
    const projectRow = await screen.findByTestId(
      'command-palette-item-switch:project:org-b:project-c',
    );
    await waitFor(() => {
      expect(projectRow).toHaveAttribute('aria-selected', 'true');
    });
    fireEvent.keyDown(input, { key: 'Tab' });
    await waitFor(() => {
      expect(getScopeTrail()).toEqual(['Org B', 'Project C']);
    });

    fireEvent.click(
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
    fireEvent.change(input, { target: { value: 'logs' } });

    const row = await screen.findByTestId('command-palette-item-project-logs');
    expect(
      within(row).getByText('Org B / Project C (project-c)'),
    ).toBeInTheDocument();

    fireEvent.click(row);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(
        '/orgs/org-b/projects/project-c/logs',
        undefined,
        { shallow: false },
      );
    });
  });

  it('resolves project pages to the current org first project without recents', async () => {
    router.query = { orgSlug: 'org-b' };
    useProjectMock.mockReturnValue({
      project: null,
      loading: false,
      error: null,
      refetch: vi.fn(),
      projectNotFound: false,
    });

    renderProvider();
    const input = await openPalette();
    fireEvent.change(input, { target: { value: 'logs' } });

    fireEvent.click(
      await screen.findByTestId('command-palette-item-project-logs'),
    );

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
    fireEvent.change(input, { target: { value: 'project' } });

    await screen.findByTestId(
      'command-palette-item-switch:project:org-b:project-c',
    );

    const rows = screen.getAllByTestId(/command-palette-item-switch:project:/);
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'command-palette-item-switch:project:org-b:project-c',
      'command-palette-item-switch:project:org-a:project-a',
      'command-palette-item-switch:project:org-a:project-b',
    ]);
  });

  it('stores org-scoped recents without a project subdomain', async () => {
    renderProvider();
    const input = await openPalette();
    fireEvent.change(input, { target: { value: 'organization settings' } });

    fireEvent.click(
      await screen.findByTestId('command-palette-item-org-settings'),
    );

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
