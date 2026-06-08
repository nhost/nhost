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
      columns: ['test_id'],
      referencedSchema: 'public',
      referencedTable: 'test_table',
      referencedColumns: ['id'],
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
      columns: ['test_id'],
      referencedSchema: 'public',
      referencedTable: 'test_table',
      referencedColumns: ['id'],
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
      columns: ['test_id'],
      referencedSchema: 'public',
      referencedTable: 'test_table',
      referencedColumns: ['id'],
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
    foreignKeyRelation: {
      name: 'test_table_test_id_fkey',
      columns: ['test_id'],
      referencedSchema: 'public',
      referencedTable: 'test_table',
      referencedColumns: ['id'],
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
  });

  expect(transaction).toHaveLength(0);
});

test('should not return any query if the composite foreign key relation has not changed', async () => {
  const transaction = prepareUpdateForeignKeyConstraintQuery({
    dataSource: 'test_datasource',
    schema: 'public',
    table: 'child',
    originalForeignKeyRelation: {
      name: 'child_a_b_fkey',
      columns: ['a', 'b'],
      referencedSchema: 'public',
      referencedTable: 'parent',
      referencedColumns: ['x', 'y'],
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
    foreignKeyRelation: {
      name: 'child_a_b_fkey',
      columns: ['a', 'b'],
      referencedSchema: 'public',
      referencedTable: 'parent',
      referencedColumns: ['x', 'y'],
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
  });

  expect(transaction).toHaveLength(0);
});

test('should treat a re-pairing of the same composite columns as a change', async () => {
  const transaction = prepareUpdateForeignKeyConstraintQuery({
    dataSource: 'test_datasource',
    schema: 'public',
    table: 'child',
    originalForeignKeyRelation: {
      name: 'child_a_b_fkey',
      columns: ['a', 'b'],
      referencedSchema: 'public',
      referencedTable: 'parent',
      referencedColumns: ['x', 'y'],
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
    foreignKeyRelation: {
      name: 'child_a_b_fkey',
      columns: ['a', 'b'],
      referencedSchema: 'public',
      referencedTable: 'parent',
      referencedColumns: ['y', 'x'],
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
  });

  expect(transaction).toHaveLength(2);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE public.child DROP CONSTRAINT IF EXISTS child_a_b_fkey;',
  );
  expect(transaction[1].args.sql).toBe(
    'ALTER TABLE public.child ADD CONSTRAINT child_a_b_fkey FOREIGN KEY (a,b) REFERENCES public.parent (y,x) ON UPDATE RESTRICT ON DELETE CASCADE;',
  );
});

test('should prepare a query to drop the original foreign key constraint and a query to alter the table and add the updated foreign key constraint', async () => {
  const transaction = prepareUpdateForeignKeyConstraintQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalForeignKeyRelation: {
      name: 'test_table_test_id_fkey',
      columns: ['test_id'],
      referencedSchema: 'public',
      referencedTable: 'test_table',
      referencedColumns: ['id'],
      updateAction: 'RESTRICT',
      deleteAction: 'CASCADE',
    },
    foreignKeyRelation: {
      name: 'test_table_test_id_fkey',
      columns: ['test_id'],
      referencedSchema: 'public',
      referencedTable: 'test_table_new',
      referencedColumns: ['id'],
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
