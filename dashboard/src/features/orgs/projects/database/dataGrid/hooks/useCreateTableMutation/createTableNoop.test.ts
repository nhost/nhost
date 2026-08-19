import createTable from '@/features/orgs/projects/database/dataGrid/hooks/useCreateTableMutation/createTable';
import createTableMigration from '@/features/orgs/projects/database/dataGrid/hooks/useCreateTableMutation/createTableMigration';
import type { DatabaseTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const fetchMock = vi.fn();

const invalidTable: DatabaseTable = {
  name: 'children',
  columns: [
    { name: 'tenant_id', type: 'uuid' },
    { name: 'parent_id', type: 'uuid' },
  ],
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

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('create table no-op requests', () => {
  it('does not issue a direct query request for invalid prepared operations', async () => {
    await expect(
      createTable({
        dataSource: 'default',
        schema: 'public',
        appUrl: 'https://hasura.example',
        adminSecret: 'test-secret',
        table: invalidTable,
      }),
    ).rejects.toThrow('Unable to create a table with invalid constraints.');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not issue a migrations request for invalid prepared operations', async () => {
    await expect(
      createTableMigration({
        dataSource: 'default',
        schema: 'public',
        appUrl: 'https://hasura.example',
        adminSecret: 'test-secret',
        table: invalidTable,
      }),
    ).rejects.toThrow('Unable to create a table with invalid constraints.');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
