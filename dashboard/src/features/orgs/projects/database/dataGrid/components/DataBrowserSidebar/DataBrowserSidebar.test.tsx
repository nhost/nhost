import { vi } from 'vitest';
import { render, screen, TestUserEvent, waitFor } from '@/tests/testUtils';
import DataBrowserSidebar from './DataBrowserSidebar';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useIsPlatform: vi.fn(),
  useProject: vi.fn(),
  useDatabaseQuery: vi.fn(),
  useGetEnumsSet: vi.fn(),
  useDataBrowserActions: vi.fn(),
  useGetTrackedTablesSet: vi.fn(),
  useGetTrackedFunctionsSet: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@/features/orgs/projects/common/hooks/useIsPlatform', () => ({
  useIsPlatform: mocks.useIsPlatform,
}));

vi.mock('@/features/orgs/projects/hooks/useProject', () => ({
  useProject: mocks.useProject,
}));

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery',
  () => ({
    useDatabaseQuery: mocks.useDatabaseQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useGetEnumsSet',
  () => ({
    useGetEnumsSet: mocks.useGetEnumsSet,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useDataBrowserActions',
  () => ({
    useDataBrowserActions: mocks.useDataBrowserActions,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useGetTrackedTablesSet',
  () => ({
    useGetTrackedTablesSet: mocks.useGetTrackedTablesSet,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useGetTrackedFunctionsSet',
  () => ({
    useGetTrackedFunctionsSet: mocks.useGetTrackedFunctionsSet,
  }),
);

const mockRouterValue = {
  basePath: '',
  pathname:
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/browser/[dataSourceSlug]/[schemaSlug]',
  route:
    '/orgs/[orgSlug]/projects/[appSubdomain]/database/browser/[dataSourceSlug]/[schemaSlug]',
  asPath: '/orgs/xyz/projects/test-project/database/browser/default/public',
  isLocaleDomain: false,
  isReady: true,
  isPreview: false,
  query: {
    orgSlug: 'xyz',
    appSubdomain: 'test-project',
    dataSourceSlug: 'default',
    schemaSlug: 'public',
  },
  push: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
  beforePopState: vi.fn(),
  events: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
  isFallback: false,
};

const mockDatabaseData = {
  schemas: [{ schema_name: 'public' }],
  tableLikeObjects: [
    {
      table_schema: 'public',
      table_name: 'users',
      table_type: 'ORDINARY TABLE',
      updatability: 1,
    },
    {
      table_schema: 'public',
      table_name: 'posts',
      table_type: 'ORDINARY TABLE',
      updatability: 1,
    },
    {
      table_schema: 'public',
      table_name: 'status_enum',
      table_type: 'ORDINARY TABLE',
      updatability: 1,
    },
    {
      table_schema: 'public',
      table_name: 'user_activity',
      table_type: 'VIEW',
      updatability: 0,
    },
    {
      table_schema: 'public',
      table_name: 'user_summary',
      table_type: 'MATERIALIZED VIEW',
      updatability: 0,
    },
  ],
  functions: [
    {
      function_schema: 'public',
      function_name: 'search_users',
      function_oid: '16384',
    },
  ],
  metadata: {},
};

const allTrackedPaths = new Set([
  'public.users',
  'public.posts',
  'public.status_enum',
  'public.user_activity',
  'public.user_summary',
  'public.search_users',
]);

function setupMocks() {
  mocks.useRouter.mockReturnValue(mockRouterValue);
  mocks.useIsPlatform.mockReturnValue(false);
  mocks.useProject.mockReturnValue({
    project: {
      config: { hasura: { adminSecret: 'secret' } },
      subdomain: 'test',
      region: 'local',
    },
  });
  mocks.useDatabaseQuery.mockReturnValue({
    data: mockDatabaseData,
    status: 'success',
    refetch: vi.fn(),
  });
  mocks.useGetEnumsSet.mockReturnValue({
    data: new Set(['public.status_enum']),
  });
  mocks.useDataBrowserActions.mockReturnValue({
    optimisticlyRemovedObject: undefined,
    sidebarMenuObject: undefined,
    setSidebarMenuObject: vi.fn(),
    handleDeleteDatabaseObject: vi.fn(),
    handleEditPermission: vi.fn(),
    handleEditGraphQLSettings: vi.fn(),
    handleEditRelationships: vi.fn(),
    openEditTableDrawer: vi.fn(),
    openEditViewDrawer: vi.fn(),
    openEditFunctionDrawer: vi.fn(),
    openCreateTableDrawer: vi.fn(),
  });
  mocks.useGetTrackedTablesSet.mockReturnValue({ data: allTrackedPaths });
  mocks.useGetTrackedFunctionsSet.mockReturnValue({ data: allTrackedPaths });
}

function getVisibleObjectNames(): string[] {
  const nav = screen.getByRole('navigation', {
    name: /database navigation/i,
  });
  const links = nav.querySelectorAll('a');
  return Array.from(links).map((link) => link.textContent?.trim() || '');
}

describe('DataBrowserSidebar', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should filter objects by type when a filter button is clicked', async () => {
    const user = new TestUserEvent();
    render(<DataBrowserSidebar />);

    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument();
    });

    const tableFilter = screen.getByRole('button', {
      name: 'Toggle filter by Table',
    });
    await user.click(tableFilter);

    await waitFor(() => {
      const names = getVisibleObjectNames();
      expect(names).toContain('users');
      expect(names).toContain('posts');
      expect(names).not.toContain('status_enum');
      expect(names).not.toContain('user_activity');
      expect(names).not.toContain('user_summary');
      expect(names).not.toContain('search_users');
    });

    await user.click(tableFilter);

    await waitFor(() => {
      const names = getVisibleObjectNames();
      expect(names).toContain('users');
      expect(names).toContain('posts');
      expect(names).toContain('status_enum');
      expect(names).toContain('user_activity');
      expect(names).toContain('user_summary');
      expect(names).toContain('search_users');
    });
  });

  it('should filter objects by name using the search input', async () => {
    const user = new TestUserEvent();
    render(<DataBrowserSidebar />);

    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search objects...');
    await user.type(searchInput, 'user');

    await waitFor(() => {
      const names = getVisibleObjectNames();
      expect(names).toContain('users');
      expect(names).toContain('user_activity');
      expect(names).toContain('search_users');
      expect(names).not.toContain('posts');
      expect(names).not.toContain('status_enum');
    });
  });

  it('should combine search and type filters', async () => {
    const user = new TestUserEvent();
    render(<DataBrowserSidebar />);

    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search objects...');
    await user.type(searchInput, 'user');

    const tableFilter = screen.getByRole('button', {
      name: 'Toggle filter by Table',
    });
    await user.click(tableFilter);

    await waitFor(() => {
      const names = getVisibleObjectNames();
      expect(names).toEqual(['users']);
    });
  });

  it('should filter both views and materialized views with a single View filter', async () => {
    const user = new TestUserEvent();
    render(<DataBrowserSidebar />);

    await waitFor(() => {
      expect(screen.getByText('users')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', {
        name: 'Toggle filter by Materialized View',
      }),
    ).not.toBeInTheDocument();

    const viewFilter = screen.getByRole('button', {
      name: 'Toggle filter by View',
    });
    await user.click(viewFilter);

    await waitFor(() => {
      const names = getVisibleObjectNames();
      expect(names).toContain('user_activity');
      expect(names).toContain('user_summary');
      expect(names).not.toContain('users');
      expect(names).not.toContain('posts');
      expect(names).not.toContain('search_users');
    });
  });
});
