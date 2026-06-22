import { vi } from 'vitest';
import { render, screen } from '@/tests/testUtils';
import SchemaDiagram from './SchemaDiagram';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  useExportMetadata: vi.fn(),
  useAllTableColumns: vi.fn(),
  useDatabaseQuery: vi.fn(),
  useGetTrackedTablesSet: vi.fn(),
  useGetRemoteAppRolesQuery: vi.fn(),
  useRemoteApplicationGQLClient: vi.fn(),
  useDataBrowserActions: vi.fn(),
  useSchemaGraph: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

vi.mock('@/features/orgs/hooks/useRemoteApplicationGQLClient', () => ({
  useRemoteApplicationGQLClient: mocks.useRemoteApplicationGQLClient,
}));

vi.mock('@/features/orgs/projects/common/hooks/useExportMetadata', () => ({
  useExportMetadata: mocks.useExportMetadata,
  EXPORT_METADATA_QUERY_KEY: 'export-metadata',
}));

vi.mock('./useAllTableColumns', () => ({
  default: mocks.useAllTableColumns,
  ALL_TABLE_COLUMNS_QUERY_KEY: 'schema-diagram-all-columns',
}));

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery',
  () => ({
    useDatabaseQuery: mocks.useDatabaseQuery,
  }),
);

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useGetTrackedTablesSet',
  () => ({
    useGetTrackedTablesSet: mocks.useGetTrackedTablesSet,
  }),
);

vi.mock('@/utils/__generated__/graphql', async (orig) => {
  const actual = await orig<typeof import('@/utils/__generated__/graphql')>();
  return {
    ...actual,
    useGetRemoteAppRolesQuery: mocks.useGetRemoteAppRolesQuery,
  };
});

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useDataBrowserActions',
  () => ({
    useDataBrowserActions: mocks.useDataBrowserActions,
  }),
);

vi.mock('./useSchemaGraph', async (orig) => {
  const actual = await orig<typeof import('./useSchemaGraph')>();
  return {
    ...actual,
    default: mocks.useSchemaGraph,
  };
});

function setHooks({
  metadataLoading = false,
  columnsLoading = false,
  rolesLoading = false,
  metadataError,
  columnsError,
  rolesError,
  metadata = [],
  columns = [],
  foreignKeys = [],
  totalTableCount = 0,
  nodes = [] as Array<{ id: string }>,
}: {
  metadataLoading?: boolean;
  columnsLoading?: boolean;
  rolesLoading?: boolean;
  metadataError?: Error;
  columnsError?: Error;
  rolesError?: Error;
  metadata?: unknown[];
  columns?: unknown[];
  foreignKeys?: unknown[];
  totalTableCount?: number;
  nodes?: Array<{ id: string }>;
} = {}) {
  mocks.useRouter.mockReturnValue({
    query: { dataSourceSlug: 'default' },
    push: vi.fn(),
    asPath: '/orgs/o/projects/p/database/schema/default',
  });

  mocks.useExportMetadata.mockReturnValue({
    data: metadata,
    isLoading: metadataLoading,
    error: metadataError,
  });

  mocks.useAllTableColumns.mockReturnValue({
    data: { columns, foreignKeys },
    isLoading: columnsLoading,
    error: columnsError,
  });

  mocks.useGetRemoteAppRolesQuery.mockReturnValue({
    data: { authRoles: [{ role: 'user' }, { role: 'manager' }] },
    loading: rolesLoading,
    error: rolesError,
  });

  mocks.useRemoteApplicationGQLClient.mockReturnValue({});

  mocks.useGetTrackedTablesSet.mockReturnValue({ data: new Set<string>() });

  mocks.useDatabaseQuery.mockReturnValue({
    data: { tableLikeObjects: [] },
    refetch: vi.fn().mockResolvedValue(undefined),
  });

  mocks.useDataBrowserActions.mockReturnValue({
    sidebarMenuObject: undefined,
    removableObject: undefined,
    openCreateTableDrawer: vi.fn(),
    setSidebarMenuObject: vi.fn(),
    handleEditPermission: vi.fn(),
    handleEditRelationships: vi.fn(),
    handleEditGraphQLSettings: vi.fn(),
    handleDeleteDatabaseObject: vi.fn(),
    openEditTableDrawer: vi.fn(),
  });

  mocks.useSchemaGraph.mockReturnValue({
    nodes,
    edges: [],
    totalTableCount,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SchemaDiagram', () => {
  it('shows a spinner while metadata is loading', () => {
    setHooks({ metadataLoading: true });
    const { container } = render(<SchemaDiagram />);

    // The Spinner has role="status" via aria-busy; assert presence of the SVG.
    expect(container.querySelector('svg.animate-spin')).not.toBeNull();
  });

  it('shows a spinner while columns are loading', () => {
    setHooks({ columnsLoading: true });
    const { container } = render(<SchemaDiagram />);
    expect(container.querySelector('svg.animate-spin')).not.toBeNull();
  });

  it('shows a spinner while roles are loading', () => {
    setHooks({ rolesLoading: true });
    const { container } = render(<SchemaDiagram />);
    expect(container.querySelector('svg.animate-spin')).not.toBeNull();
  });

  it('renders the error message when columns fail to load', () => {
    setHooks({ columnsError: new Error('permission denied for schema X') });
    render(<SchemaDiagram />);

    expect(
      screen.getByText('permission denied for schema X'),
    ).toBeInTheDocument();
  });

  it('renders a generic message when the error is not an Error instance', () => {
    // useExportMetadata exposes `error: unknown`; if it's a plain object, the
    // component falls back to the generic copy.
    setHooks({
      columnsError: { foo: 'bar' } as unknown as Error,
    });
    render(<SchemaDiagram />);

    expect(
      screen.getByText('Failed to load schema diagram.'),
    ).toBeInTheDocument();
  });

  it('renders the empty state when there are no tables at all', () => {
    setHooks({ totalTableCount: 0 });
    render(<SchemaDiagram />);

    expect(screen.getByText('No tables found.')).toBeInTheDocument();
    // The toolbar should still render so the user can change filters/role.
    expect(
      screen.getByRole('button', { name: /New Table/i }),
    ).toBeInTheDocument();
  });

  it('renders the filtered-empty state when filters hide every table', () => {
    setHooks({ totalTableCount: 3, nodes: [] });
    render(<SchemaDiagram />);

    expect(
      screen.getByText('No tables match the current filters.'),
    ).toBeInTheDocument();
  });
});
