import { ReactFlowProvider } from '@xyflow/react';
import { vi } from 'vitest';
import type { HasuraMetadataTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import {
  type TableActionsContextValue,
  TableActionsProvider,
} from './TableActionsContext';
import TableNode from './TableNode';
import type { TableNodeData } from './useSchemaGraph';

mockPointerEvent();

function makeActions(
  overrides: Partial<TableActionsContextValue['actions']> = {},
): TableActionsContextValue['actions'] {
  return {
    sidebarMenuObject: undefined,
    removableObject: undefined,
    optimisticlyRemovedObject: undefined,
    setSidebarMenuObject: vi.fn(),
    handleEditPermission: vi.fn(),
    handleEditFunctionPermission: vi.fn(),
    handleDeleteDatabaseObject: vi.fn(),
    handleEditGraphQLSettings: vi.fn(),
    handleEditRelationships: vi.fn(),
    openCreateTableDrawer: vi.fn(),
    openEditTableDrawer: vi.fn(),
    openEditViewDrawer: vi.fn(),
    openEditFunctionDrawer: vi.fn(),
    handleEditTableSubmit: vi.fn(),
    handleCreateTableSubmit: vi.fn(),
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: test stub; we only set the fields TableNode reads.
  } as any;
}

function renderNode(
  data: TableNodeData,
  context: TableActionsContextValue | null = {
    actions: makeActions(),
    trackedTablesSet: new Set([`${data.schema}.${data.table}`]),
    enumTablesSet: new Set(),
  },
) {
  return render(
    <ReactFlowProvider>
      <TableActionsProvider value={context}>
        <TableNode
          id={`${data.schema}.${data.table}`}
          type="tableNode"
          data={data}
          // The remaining NodeProps fields are not read by the view.
          // biome-ignore lint/suspicious/noExplicitAny: test stub for unused NodeProps fields.
          {...({} as any)}
        />
      </TableActionsProvider>
    </ReactFlowProvider>,
  );
}

const baseData: TableNodeData = {
  schema: 'public',
  table: 'users',
  objectType: 'ORDINARY TABLE',
  tableGraphqlName: undefined,
  role: 'admin',
  namingMode: 'graphql',
  metadataTable: {
    table: { schema: 'public', name: 'users' },
    configuration: {},
  } as HasuraMetadataTable,
  computedFields: [],
  columns: [
    {
      name: 'id',
      graphqlName: undefined,
      dataType: 'uuid',
      isNullable: false,
      isPrimary: true,
      isForeignKey: false,
      isGenerated: false,
    },
    {
      name: 'author_id',
      graphqlName: undefined,
      dataType: 'uuid',
      isNullable: true,
      isPrimary: false,
      isForeignKey: true,
      isGenerated: false,
    },
    {
      name: 'email',
      graphqlName: undefined,
      dataType: 'text',
      isNullable: true,
      isPrimary: false,
      isForeignKey: false,
      isGenerated: false,
    },
  ],
};

describe('TableNode', () => {
  it('renders the schema, table name, and columns with PK / FK badges', () => {
    renderNode(baseData);

    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.getByText('users')).toBeInTheDocument();

    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('author_id')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();

    expect(screen.getByText('PK')).toBeInTheDocument();
    expect(screen.getByText('FK')).toBeInTheDocument();
  });

  it('renders "No columns" when the column list is empty', () => {
    renderNode({ ...baseData, columns: [] });

    expect(screen.getByText('No columns')).toBeInTheDocument();
  });

  it.each([
    { objectType: 'ORDINARY TABLE' as const, label: 'Table' },
    { objectType: 'VIEW' as const, label: 'View' },
    { objectType: 'MATERIALIZED VIEW' as const, label: 'Materialized View' },
    { objectType: 'FOREIGN TABLE' as const, label: 'Foreign Table' },
  ])('renders the "$label" object-type icon in the header for a $objectType', ({
    objectType,
    label,
  }) => {
    renderNode({ ...baseData, objectType });

    expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('renders the "Enum" icon for an enum table', () => {
    renderNode(baseData, {
      actions: makeActions(),
      trackedTablesSet: new Set(['public.users']),
      enumTablesSet: new Set(['public.users']),
    });

    expect(screen.getByLabelText('Enum')).toBeInTheDocument();
  });

  it('renders the Sigma indicator on generated columns', () => {
    renderNode({
      ...baseData,
      columns: [
        { ...baseData.columns[0], isGenerated: true },
        baseData.columns[1],
        baseData.columns[2],
      ],
    });

    expect(screen.getByLabelText('Generated column')).toBeInTheDocument();
  });

  it('forces insert/update dots to "not allowed" on generated columns, even for admin', () => {
    renderNode({
      ...baseData,
      columns: [
        { ...baseData.columns[2], name: 'computed_total', isGenerated: true },
      ],
    });

    expect(screen.getAllByLabelText('Insert: not allowed')).toHaveLength(1);
    expect(screen.getAllByLabelText('Update: not allowed')).toHaveLength(1);
  });

  it('renders a computed field row with its name, return type, and Sigma indicator', () => {
    renderNode({
      ...baseData,
      computedFields: [
        {
          name: 'posts_count',
          returnType: 'bigint',
          functionSchema: 'public',
          functionName: 'users_posts_count',
        },
      ],
    });

    expect(screen.getByText('posts_count')).toBeInTheDocument();
    expect(screen.getByText('bigint')).toBeInTheDocument();
    expect(screen.getByLabelText('Computed field')).toBeInTheDocument();
  });

  it('renders custom GraphQL names in purple when they differ from the postgres name', () => {
    renderNode({
      ...baseData,
      tableGraphqlName: 'User',
      columns: [
        baseData.columns[0],
        { ...baseData.columns[2], graphqlName: 'emailAddress' },
      ],
    });

    const customColumn = screen.getByText('emailAddress');
    expect(customColumn.className).toMatch(/text-purple-600/);
    const customTable = screen.getByText('User');
    expect(customTable.className).toMatch(/text-purple-600/);
    expect(screen.queryByText('email')).toBeNull();
  });

  it('falls back to the postgres name when graphqlName matches it', () => {
    renderNode({
      ...baseData,
      columns: [
        baseData.columns[0],
        { ...baseData.columns[2], graphqlName: 'email' },
      ],
    });

    const column = screen.getByText('email');
    expect(column.className).not.toMatch(/text-purple-600/);
  });

  it('hides computed fields and renders postgres column names in postgres mode', () => {
    renderNode({
      ...baseData,
      namingMode: 'postgres',
      tableGraphqlName: 'User',
      computedFields: [
        {
          name: 'posts_count',
          returnType: 'bigint',
          functionSchema: 'public',
          functionName: 'users_posts_count',
        },
      ],
      columns: [
        baseData.columns[0],
        { ...baseData.columns[2], graphqlName: 'emailAddress' },
      ],
    });

    expect(screen.queryByText('posts_count')).toBeNull();
    expect(screen.queryByLabelText('Computed field')).toBeNull();
    expect(screen.queryByText('emailAddress')).toBeNull();
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.queryByText('User')).toBeNull();
  });

  it('does not render the action menu when no TableActionsContext is provided', () => {
    renderNode(baseData, null);

    expect(
      screen.queryByRole('button', {
        name: /table-management-menu-users/i,
      }),
    ).toBeNull();
  });

  it('opens the action menu and calls openEditTableDrawer for a tracked table', async () => {
    const openEditTableDrawer = vi.fn();
    const setSidebarMenuObject = vi.fn();

    renderNode(baseData, {
      actions: makeActions({
        sidebarMenuObject: 'ORDINARY TABLE.public.users',
        setSidebarMenuObject,
        openEditTableDrawer,
      }),
      trackedTablesSet: new Set(['public.users']),
      enumTablesSet: new Set(),
    });

    const user = new TestUserEvent();

    // Menu is open via context; click the "Edit Table" entry.
    const editItem = await screen.findByRole('menuitem', {
      name: /Edit Table/i,
    });
    await user.click(editItem);

    expect(openEditTableDrawer).toHaveBeenCalledWith('public', 'users');
  });

  it('disables "Edit Permissions" and "Edit Relationships" for an untracked table', async () => {
    renderNode(baseData, {
      actions: makeActions({
        sidebarMenuObject: 'ORDINARY TABLE.public.users',
      }),
      trackedTablesSet: new Set(),
      enumTablesSet: new Set(),
    });

    const permsItem = await screen.findByRole('menuitem', {
      name: /Edit Permissions/i,
    });
    const relsItem = await screen.findByRole('menuitem', {
      name: /Edit Relationships/i,
    });

    expect(permsItem).toHaveAttribute('data-disabled');
    expect(relsItem).toHaveAttribute('data-disabled');
  });

  it('shows "Edit View" / "Delete View" for a view and routes edit to openEditViewDrawer', async () => {
    const openEditViewDrawer = vi.fn();
    const openEditTableDrawer = vi.fn();
    const handleDeleteDatabaseObject = vi.fn();

    renderNode(
      { ...baseData, table: 'active_users', objectType: 'VIEW' },
      {
        actions: makeActions({
          sidebarMenuObject: 'VIEW.public.active_users',
          openEditViewDrawer,
          openEditTableDrawer,
          handleDeleteDatabaseObject,
        }),
        trackedTablesSet: new Set(['public.active_users']),
        enumTablesSet: new Set(),
      },
    );

    const user = new TestUserEvent();

    const editItem = await screen.findByRole('menuitem', {
      name: /Edit View/i,
    });
    await user.click(editItem);
    expect(openEditViewDrawer).toHaveBeenCalledWith(
      'public',
      'active_users',
      'VIEW',
    );
    expect(openEditTableDrawer).not.toHaveBeenCalled();

    const deleteItem = await screen.findByRole('menuitem', {
      name: /Delete View/i,
    });
    await user.click(deleteItem);
    expect(handleDeleteDatabaseObject).toHaveBeenCalledWith(
      'public',
      'active_users',
      'VIEW',
    );
  });

  it('routes a materialized-view edit to openEditViewDrawer with MATERIALIZED VIEW', async () => {
    const openEditViewDrawer = vi.fn();

    renderNode(
      { ...baseData, table: 'daily_metrics', objectType: 'MATERIALIZED VIEW' },
      {
        actions: makeActions({
          sidebarMenuObject: 'MATERIALIZED VIEW.public.daily_metrics',
          openEditViewDrawer,
        }),
        trackedTablesSet: new Set(['public.daily_metrics']),
        enumTablesSet: new Set(),
      },
    );

    const user = new TestUserEvent();
    const editItem = await screen.findByRole('menuitem', {
      name: /Edit Materialized View/i,
    });
    await user.click(editItem);
    expect(openEditViewDrawer).toHaveBeenCalledWith(
      'public',
      'daily_metrics',
      'MATERIALIZED VIEW',
    );
  });
});
