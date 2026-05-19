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
  role: 'admin',
  metadataTable: {
    table: { schema: 'public', name: 'users' },
    configuration: {},
  } as HasuraMetadataTable,
  columns: [
    {
      name: 'id',
      dataType: 'uuid',
      isNullable: false,
      isPrimary: true,
      isForeignKey: false,
    },
    {
      name: 'author_id',
      dataType: 'uuid',
      isNullable: true,
      isPrimary: false,
      isForeignKey: true,
    },
    {
      name: 'email',
      dataType: 'text',
      isNullable: true,
      isPrimary: false,
      isForeignKey: false,
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
});
