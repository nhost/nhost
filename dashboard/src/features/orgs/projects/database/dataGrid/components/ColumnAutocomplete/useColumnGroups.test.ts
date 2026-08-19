import type { FetchTableSchemaReturnType } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import useColumnGroups from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete/useColumnGroups';
import type { FetchMetadataReturnType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const metadata: FetchMetadataReturnType = {
  resourceVersion: 1,
  tables: [
    {
      table: { schema: 'public', name: 'memberships' },
      configuration: {},
      object_relationships: [
        {
          name: 'tenantUser',
          using: { foreign_key_constraint_on: 'tenant_id' },
        },
      ],
    },
  ],
};

function tableData(
  columns: string[],
  foreignKeyRelations: FetchTableSchemaReturnType['foreignKeyRelations'],
): FetchTableSchemaReturnType {
  return {
    columns: columns.map((column_name) => ({ column_name })),
    foreignKeyRelations,
    candidateKeys: [],
    uniqueConstraints: [],
    constraintColumnSets: [],
    error: null,
  };
}

describe('useColumnGroups', () => {
  it('does not expose a composite relation as a truncated autocomplete action', () => {
    const options = useColumnGroups({
      selectedSchema: 'public',
      selectedTable: 'memberships',
      metadata,
      tableData: tableData(
        ['tenant_id', 'user_id'],
        [
          {
            name: 'memberships_user_fkey',
            columns: ['tenant_id', 'user_id'],
            referencedSchema: 'public',
            referencedTable: 'users',
            referencedColumns: ['tenant_id', 'id'],
            updateAction: 'NO ACTION',
            deleteAction: 'NO ACTION',
          },
        ],
      ),
    });

    expect(options.map(({ value }) => value)).toEqual(['tenant_id', 'user_id']);
  });

  it('retains singular autocomplete relationship behavior', () => {
    const options = useColumnGroups({
      selectedSchema: 'public',
      selectedTable: 'memberships',
      metadata,
      tableData: tableData(
        ['tenant_id'],
        [
          {
            name: 'memberships_user_fkey',
            columns: ['tenant_id'],
            referencedSchema: 'accounts',
            referencedTable: 'users',
            referencedColumns: ['id'],
            updateAction: 'NO ACTION',
            deleteAction: 'NO ACTION',
          },
        ],
      ),
    });

    expect(options.find(({ value }) => value === 'tenantUser')).toMatchObject({
      metadata: {
        target: { schema: 'accounts', table: 'users', column: 'tenant_id' },
      },
    });
  });
});
