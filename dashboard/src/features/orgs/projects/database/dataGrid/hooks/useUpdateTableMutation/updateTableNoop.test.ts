import updateTable from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateTableMutation/updateTable';
import updateTableMigration from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateTableMutation/updateTableMigration';
import type {
  DatabaseColumn,
  DatabaseTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const fetchMock = vi.fn();
const originalColumns: DatabaseColumn[] = [
  { id: 'tenant_id', name: 'tenant_id', type: 'uuid' },
  { id: 'parent_id', name: 'parent_id', type: 'uuid' },
];
const updatedTable: DatabaseTable = {
  name: 'children',
  columns: originalColumns,
  primaryKey: [],
  foreignKeyRelations: [
    {
      name: 'invalid_fkey',
      columns: ['tenant_id', 'parent_id'],
      referencedSchema: 'public',
      referencedTable: 'parents',
      referencedColumns: ['id'],
      updateAction: 'RESTRICT',
      deleteAction: 'RESTRICT',
    },
  ],
};
const variables = {
  dataSource: 'default',
  schema: 'public',
  appUrl: 'https://hasura.example',
  adminSecret: 'test-secret',
  originalTableName: 'children',
  originalColumns,
  originalForeignKeyRelations: [],
  updatedTable,
};

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('update table invalid relation requests', () => {
  it('does not issue a direct query request', async () => {
    await expect(updateTable(variables)).rejects.toThrow(
      'Unable to update a table with invalid constraints.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not issue a migrations request', async () => {
    await expect(updateTableMigration(variables)).rejects.toThrow(
      'Unable to update a table with invalid constraints.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
