import { prepareCreateForeignKeyRelationQuery } from '@/features/orgs/projects/database/dataGrid/utils/prepareCreateForeignKeyRelationQuery';

test('should prepare an alter table query and add foreign key constraint', async () => {
  const transaction = prepareCreateForeignKeyRelationQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    foreignKeyRelation: {
      name: '',
      columns: ['test_id'],
      referencedSchema: 'public',
      referencedTable: 'test_table',
      referencedColumns: ['id'],
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE test_schema.test_table ADD CONSTRAINT test_table_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.test_table (id) ON UPDATE RESTRICT ON DELETE CASCADE;',
  );
});

test('does not emit truncated DDL for a composite relation', () => {
  const transaction = prepareCreateForeignKeyRelationQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    foreignKeyRelation: {
      name: 'test_table_tenant_id_test_id_fkey',
      columns: ['tenant_id', 'test_id'],
      referencedSchema: 'public',
      referencedTable: 'parent',
      referencedColumns: ['tenant_id', 'id'],
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
  });

  expect(transaction).toEqual([]);
});
