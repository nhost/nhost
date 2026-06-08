import { ReactFlowProvider } from '@xyflow/react';
import { vi } from 'vitest';
import type { HasuraMetadataTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  mockPointerEvent,
  render,
  screen,
  TestUserEvent,
} from '@/tests/testUtils';
import FunctionNode from './FunctionNode';
import {
  type TableActionsContextValue,
  TableActionsProvider,
} from './TableActionsContext';
import type { FunctionNodeData } from './useSchemaGraph';

mockPointerEvent();

function makeActions(
  overrides: Partial<TableActionsContextValue['actions']> = {},
): TableActionsContextValue['actions'] {
  return {
    sidebarMenuObject: undefined,
    removableObject: undefined,
    setSidebarMenuObject: vi.fn(),
    openEditFunctionDrawer: vi.fn(),
    handleEditFunctionPermission: vi.fn(),
    handleEditGraphQLSettings: vi.fn(),
    handleDeleteDatabaseObject: vi.fn(),
    ...overrides,
    // biome-ignore lint/suspicious/noExplicitAny: test stub; we only set the fields FunctionNode reads.
  } as any;
}

function renderNode(
  data: FunctionNodeData,
  context: TableActionsContextValue | null = null,
) {
  return render(
    <ReactFlowProvider>
      <TableActionsProvider value={context}>
        <FunctionNode
          id={`fn:${data.schema}.${data.name}`}
          type="functionNode"
          data={data}
          // The remaining NodeProps fields are not read by the view.
          // biome-ignore lint/suspicious/noExplicitAny: test stub for unused NodeProps fields.
          {...({} as any)}
        />
      </TableActionsProvider>
    </ReactFlowProvider>,
  );
}

const baseData: FunctionNodeData = {
  schema: 'public',
  name: 'find_users',
  oid: '12345',
  graphqlName: undefined,
  returnTablePostgres: 'users',
  returnTableGraphql: undefined,
  returnTableMetadata: undefined,
  inferFunctionPermissions: true,
  isMutationFunction: false,
  hasFunctionPermission: false,
  isUntracked: false,
  role: 'admin',
  namingMode: 'graphql',
};

describe('FunctionNode', () => {
  it('renders the schema, function name, icon, and the setof return label', () => {
    renderNode(baseData);

    expect(screen.getByText('public')).toBeInTheDocument();
    expect(screen.getByText('find_users')).toBeInTheDocument();
    expect(screen.getByLabelText('Function')).toBeInTheDocument();
    expect(screen.getByText(/setof/i)).toBeInTheDocument();
    expect(screen.getByText('users')).toBeInTheDocument();
  });

  it('shows the custom GraphQL root-field name in purple in graphql mode', () => {
    renderNode({ ...baseData, graphqlName: 'findUsers' });

    const name = screen.getByText('findUsers');
    expect(name.className).toMatch(/text-purple-600/);
    expect(screen.queryByText('find_users')).toBeNull();
  });

  it('uses the return table GraphQL name in graphql mode when present', () => {
    renderNode({ ...baseData, returnTableGraphql: 'User' });

    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.queryByText('users')).toBeNull();
  });

  it('shows the postgres function and table names in postgres mode', () => {
    renderNode({
      ...baseData,
      namingMode: 'postgres',
      graphqlName: 'findUsers',
      returnTableGraphql: 'User',
    });

    expect(screen.getByText('find_users')).toBeInTheDocument();
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.queryByText('findUsers')).toBeNull();
    expect(screen.queryByText('User')).toBeNull();
  });

  it('renders the function name in italics when untracked', () => {
    renderNode({ ...baseData, isUntracked: true });

    expect(screen.getByText('find_users').className).toMatch(/italic/);
  });

  it('shows a filled select dot for the admin role', () => {
    renderNode(baseData);

    expect(screen.getByLabelText('Select: allowed')).toBeInTheDocument();
  });

  it('shows a "not allowed" select dot when the role lacks select on the returned table', () => {
    renderNode({
      ...baseData,
      role: 'user',
      returnTableMetadata: {
        table: { schema: 'public', name: 'users' },
        configuration: {},
      } as HasuraMetadataTable,
    });

    expect(screen.getByLabelText('Select: not allowed')).toBeInTheDocument();
  });

  it('shows an "allowed" select dot when the role has select on the returned table', () => {
    renderNode({
      ...baseData,
      role: 'user',
      returnTableMetadata: {
        table: { schema: 'public', name: 'users' },
        configuration: {},
        select_permissions: [
          { role: 'user', permission: { columns: ['id'], filter: {} } },
        ],
      } as HasuraMetadataTable,
    });

    expect(screen.getByLabelText('Select: allowed')).toBeInTheDocument();
  });

  it('shows a "not allowed" dot when infer is off and the role has no function permission, even with select (regression)', () => {
    renderNode({
      ...baseData,
      role: 'user',
      inferFunctionPermissions: false,
      hasFunctionPermission: false,
      returnTableMetadata: {
        table: { schema: 'public', name: 'users' },
        configuration: {},
        select_permissions: [
          { role: 'user', permission: { columns: ['id'], filter: {} } },
        ],
      } as HasuraMetadataTable,
    });

    expect(screen.getByLabelText('Select: not allowed')).toBeInTheDocument();
  });

  it('shows a filled dot when infer is off and the role has an explicit function permission and select', () => {
    renderNode({
      ...baseData,
      role: 'user',
      inferFunctionPermissions: false,
      hasFunctionPermission: true,
      returnTableMetadata: {
        table: { schema: 'public', name: 'users' },
        configuration: {},
        select_permissions: [
          { role: 'user', permission: { columns: ['id'], filter: {} } },
        ],
      } as HasuraMetadataTable,
    });

    expect(screen.getByLabelText('Select: allowed')).toBeInTheDocument();
  });

  it('shows a hollow dot when the role has a function permission but no select on the return table', () => {
    renderNode({
      ...baseData,
      role: 'user',
      inferFunctionPermissions: false,
      hasFunctionPermission: true,
      returnTableMetadata: {
        table: { schema: 'public', name: 'users' },
        configuration: {},
      } as HasuraMetadataTable,
    });

    expect(
      screen.getByLabelText('Select: partially allowed'),
    ).toBeInTheDocument();
  });

  it('shows a "not allowed" dot for a mutation function with no explicit permission, even with infer on and select', () => {
    renderNode({
      ...baseData,
      role: 'user',
      inferFunctionPermissions: true,
      isMutationFunction: true,
      hasFunctionPermission: false,
      returnTableMetadata: {
        table: { schema: 'public', name: 'users' },
        configuration: {},
        select_permissions: [
          { role: 'user', permission: { columns: ['id'], filter: {} } },
        ],
      } as HasuraMetadataTable,
    });

    expect(screen.getByLabelText('Select: not allowed')).toBeInTheDocument();
  });

  it('does not render the actions menu when no TableActionsContext is provided', () => {
    renderNode(baseData);

    expect(
      screen.queryByRole('button', {
        name: /function-management-menu-find_users/i,
      }),
    ).toBeNull();
  });

  it('opens the actions menu and routes edit/delete to the function handlers with the OID', async () => {
    const openEditFunctionDrawer = vi.fn();
    const handleDeleteDatabaseObject = vi.fn();

    renderNode(baseData, {
      actions: makeActions({
        sidebarMenuObject: 'FUNCTION.public.12345',
        openEditFunctionDrawer,
        handleDeleteDatabaseObject,
      }),
      trackedTablesSet: new Set(),
    });

    const user = new TestUserEvent();

    const editItem = await screen.findByRole('menuitem', {
      name: /Edit Function/i,
    });
    await user.click(editItem);
    expect(openEditFunctionDrawer).toHaveBeenCalledWith(
      'public',
      'find_users',
      '12345',
    );

    const deleteItem = await screen.findByRole('menuitem', {
      name: /Delete Function/i,
    });
    await user.click(deleteItem);
    expect(handleDeleteDatabaseObject).toHaveBeenCalledWith(
      'public',
      'find_users',
      'FUNCTION',
      '12345',
    );
  });

  it('disables "Edit Permissions" for an untracked function', async () => {
    renderNode(
      { ...baseData, isUntracked: true },
      {
        actions: makeActions({
          sidebarMenuObject: 'FUNCTION.public.12345',
        }),
        trackedTablesSet: new Set(),
      },
    );

    const permsItem = await screen.findByRole('menuitem', {
      name: /Edit Permissions/i,
    });
    expect(permsItem).toHaveAttribute('data-disabled');
  });
});
