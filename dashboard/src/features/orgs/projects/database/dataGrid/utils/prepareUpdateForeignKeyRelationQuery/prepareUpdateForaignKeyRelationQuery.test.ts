import { expect, test } from 'vitest';
import prepareUpdateForeignKeyConstraintQuery from './prepareUpdateForeignKeyRelationQuery';

test('should not return any query if either the original foreign key relation or the new foreign key relation is undefined', () => {
  const firstTransaction = prepareUpdateForeignKeyConstraintQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalForeignKeyRelation: null,
    foreignKeyRelation: {
      name: 'test_table_test_id_fkey',
      columnName: 'test_id',
      referencedSchema: 'public',
      referencedTable: 'test_table',
      referencedColumn: 'id',
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
  });

  expect(firstTransaction).toHaveLength(0);

  const secondTransaction = prepareUpdateForeignKeyConstraintQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalForeignKeyRelation: {
      name: 'test_table_test_id_fkey',
      columnName: 'test_id',
      referencedSchema: 'public',
      referencedTable: 'test_table',
      referencedColumn: 'id',
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
    foreignKeyRelation: null,
  });

  expect(secondTransaction).toHaveLength(0);
});

test('should not return any query if the foreign key relation has not changed', async () => {
  const transaction = prepareUpdateForeignKeyConstraintQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalForeignKeyRelation: {
      name: 'test_table_test_id_fkey',
      columnName: 'test_id',
      referencedSchema: 'public',
      referencedTable: 'test_table',
      referencedColumn: 'id',
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
    foreignKeyRelation: {
      name: 'test_table_test_id_fkey',
      columnName: 'test_id',
      referencedSchema: 'public',
      referencedTable: 'test_table',
      referencedColumn: 'id',
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
  });

  expect(transaction).toHaveLength(0);
});

test('should prepare a query to drop the original foreign key constraint and a query to alter the table and add the updated foreign key constraint', async () => {
  const transaction = prepareUpdateForeignKeyConstraintQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalForeignKeyRelation: {
      name: 'test_table_test_id_fkey',
      columnName: 'test_id',
      referencedSchema: 'public',
      referencedTable: 'test_table',
      referencedColumn: 'id',
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
    foreignKeyRelation: {
      name: 'test_table_test_id_fkey',
      columnName: 'test_id',
      referencedSchema: 'public',
      referencedTable: 'test_table_new',
      referencedColumn: 'id',
      updateAction: 'RESTRICT',
      deleteAction: 'SET NULL',
    },
  });

  expect(transaction).toHaveLength(2);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE test_schema.test_table DROP CONSTRAINT IF EXISTS test_table_test_id_fkey;',
  );
  expect(transaction[1].args.sql).toBe(
    'ALTER TABLE test_schema.test_table ADD CONSTRAINT test_table_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.test_table_new (id) ON UPDATE RESTRICT ON DELETE SET NULL;',
  );
});
