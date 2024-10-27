import { expect, test } from 'vitest';
import prepareCreateForeignKeyRelationQuery from './prepareCreateForeignKeyRelationQuery';

test('should prepare an alter table query and add foreign key constraint', async () => {
  const transaction = prepareCreateForeignKeyRelationQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    foreignKeyRelation: {
      name: '',
      columnName: 'test_id',
      referencedSchema: 'public',
      referencedTable: 'test_table',
      referencedColumn: 'id',
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE test_schema.test_table ADD CONSTRAINT test_table_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.test_table (id) ON UPDATE RESTRICT ON DELETE CASCADE;',
  );
});
