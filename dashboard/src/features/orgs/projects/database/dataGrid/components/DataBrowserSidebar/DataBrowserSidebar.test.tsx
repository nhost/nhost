import { vi } from 'vitest';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
  waitFor,
} from '@/tests/testUtils';
import DataBrowserSidebar from './DataBrowserSidebar';

mockPointerEvent();

const DIRTY_MESSAGE =
  'You have unsaved local changes. Are you sure you want to discard them?';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useIsPlatform: vi.fn(),
  useProject: vi.fn(),
  useDatabaseQuery: vi.fn(),
  useGetEnumsSet: vi.fn(),
  useGetTrackedTablesSet: vi.fn(),
  useGetTrackedFunctionsSet: vi.fn(),
  useDeleteDatabaseObjectWithToastMutation: vi.fn(),
  useFunctionQuery: vi.fn(),
  useTrackFunctionWithTableToast: vi.fn(),
  useFunctionCustomizationQuery: vi.fn(),
  useSetFunctionCustomizationMutation: vi.fn(),
  useIsTrackedTable: vi.fn(),
  useGetMetadataResourceVersion: vi.fn(),
  useSetTableTrackingMutation: vi.fn(),
  useTableCustomizationQuery: vi.fn(),
  useSetTableCustomizationMutation: vi.fn(),
  useTableSchemaQuery: vi.fn(),
  useTableIsEnumQuery: vi.fn(),
  useSetTableIsEnumMutation: vi.fn(),
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

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useDeleteDatabaseObjectMutation',
  () => ({
    useDeleteDatabaseObjectWithToastMutation:
      mocks.useDeleteDatabaseObjectWithToastMutation,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery',
  () => ({
    useFunctionQuery: mocks.useFunctionQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useTrackFunctionWithTable',
  () => ({
    useTrackFunctionWithTableToast: mocks.useTrackFunctionWithTableToast,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useFunctionCustomizationQuery',
  () => ({
    useFunctionCustomizationQuery: mocks.useFunctionCustomizationQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSetFunctionCustomizationMutation',
  () => ({
    useSetFunctionCustomizationMutation:
      mocks.useSetFunctionCustomizationMutation,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useIsTrackedTable',
  () => ({
    useIsTrackedTable: mocks.useIsTrackedTable,
  }),
);

vi.mock(
  '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion',
  () => ({
    useGetMetadataResourceVersion: mocks.useGetMetadataResourceVersion,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSetTableTrackingMutation',
  () => ({
    useSetTableTrackingMutation: mocks.useSetTableTrackingMutation,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useTableCustomizationQuery',
  () => ({
    useTableCustomizationQuery: mocks.useTableCustomizationQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSetTableCustomizationMutation',
  () => ({
    useSetTableCustomizationMutation: mocks.useSetTableCustomizationMutation,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery',
  () => ({
    useTableSchemaQuery: mocks.useTableSchemaQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useTableIsEnumQuery',
  () => ({
    useTableIsEnumQuery: mocks.useTableIsEnumQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useSetTableIsEnumMutation',
  () => ({
    useSetTableIsEnumMutation: mocks.useSetTableIsEnumMutation,
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
  mocks.useGetTrackedTablesSet.mockReturnValue({ data: allTrackedPaths });
  mocks.useGetTrackedFunctionsSet.mockReturnValue({ data: allTrackedPaths });
  mocks.useDeleteDatabaseObjectWithToastMutation.mockReturnValue({
    mutateAsync: vi.fn(),
  });
  mocks.useFunctionQuery.mockReturnValue({
    data: {
      functionMetadata: {
        functionType: 'STABLE',
        returnTableName: 'user_profile',
        returnTableSchema: 'public',
      },
    },
  });
  mocks.useTrackFunctionWithTableToast.mockReturnValue({
    isTracked: true,
    isReturnTableUntracked: false,
    isPending: false,
    trackFunctionWithToast: vi.fn(),
    toggleTrackingFunctionWithToast: vi.fn(),
  });
  mocks.useFunctionCustomizationQuery.mockReturnValue({
    data: { configuration: {} },
    isLoading: false,
    refetch: vi.fn(),
  });
  mocks.useSetFunctionCustomizationMutation.mockReturnValue({
    mutateAsync: vi.fn(),
  });
  mocks.useIsTrackedTable.mockReturnValue({ data: true });
  mocks.useGetMetadataResourceVersion.mockReturnValue({ data: 1 });
  mocks.useSetTableTrackingMutation.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
  mocks.useTableCustomizationQuery.mockReturnValue({
    data: { column_config: { id: { custom_name: '' } } },
    isLoading: false,
    refetch: vi.fn(),
  });
  mocks.useSetTableCustomizationMutation.mockReturnValue({
    mutateAsync: vi.fn(),
  });
  mocks.useTableSchemaQuery.mockReturnValue({
    data: {
      columns: [
        { column_name: 'id', data_type: 'uuid', full_data_type: 'uuid' },
      ],
    },
    isLoading: false,
  });
  mocks.useTableIsEnumQuery.mockReturnValue({
    data: false,
    isLoading: false,
    refetch: vi.fn(),
  });
  mocks.useSetTableIsEnumMutation.mockReturnValue({
    mutateAsync: vi.fn(),
  });
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

async function openGraphQLSettingsDrawer(
  user: TestUserEvent,
  triggerId: string,
  objectName: string,
) {
  await waitFor(() => {
    expect(screen.getByText(objectName)).toBeInTheDocument();
  });

  const trigger = document.getElementById(triggerId);
  expect(trigger).not.toBeNull();
  await user.click(trigger as HTMLElement);

  await user.click(
    await screen.findByRole('menuitem', { name: /Edit GraphQL/ }),
  );
}

describe('DataBrowserSidebar — discard guard for GraphQL settings drawer', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the discard modal when the function GraphQL settings drawer has unsaved changes', async () => {
    const user = new TestUserEvent();
    render(<DataBrowserSidebar />);

    await openGraphQLSettingsDrawer(
      user,
      'function-management-menu-search_users',
      'search_users',
    );

    const aggregateInput = await screen.findByPlaceholderText(
      'search_users_aggregate (default)',
    );
    await user.type(aggregateInput, 'searchUsersAggregate');

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText(DIRTY_MESSAGE)).toBeInTheDocument();
  });

  it('opens the discard modal when ColumnsNameCustomizationSection has unsaved changes', async () => {
    const user = new TestUserEvent();
    render(<DataBrowserSidebar />);

    await openGraphQLSettingsDrawer(
      user,
      'table-management-menu-users',
      'users',
    );

    const fieldNameInput = await screen.findByPlaceholderText('id (default)');
    await user.type(fieldNameInput, 'identifier');

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText(DIRTY_MESSAGE)).toBeInTheDocument();
  });

  it('opens the discard modal when CustomGraphQLRootFieldsSection has unsaved changes', async () => {
    const user = new TestUserEvent();
    render(<DataBrowserSidebar />);

    await openGraphQLSettingsDrawer(
      user,
      'table-management-menu-users',
      'users',
    );

    const customTableNameInput =
      await screen.findByLabelText('Custom Table Name');
    await user.type(customTableNameInput, 'CustomUsers');

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText(DIRTY_MESSAGE)).toBeInTheDocument();
  });

  it('opens the discard modal when SetIsEnumSection has unsaved changes', async () => {
    const user = new TestUserEvent();
    render(<DataBrowserSidebar />);

    await openGraphQLSettingsDrawer(
      user,
      'table-management-menu-users',
      'users',
    );

    const switchControl = await screen.findByRole('switch');
    await user.click(switchControl);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText(DIRTY_MESSAGE)).toBeInTheDocument();
  });
});
