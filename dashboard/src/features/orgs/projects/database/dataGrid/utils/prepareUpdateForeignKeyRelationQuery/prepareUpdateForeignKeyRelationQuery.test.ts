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

test('preserves a custom constraint name for action-only changes', () => {
  const originalForeignKeyRelation = {
    name: 'custom_author_reference',
    columns: ['test_id'],
    referencedSchema: 'public',
    referencedTable: 'authors',
    referencedColumns: ['id'],
    updateAction: 'RESTRICT' as const,
    deleteAction: 'RESTRICT' as const,
  };

  const transaction = prepareUpdateForeignKeyConstraintQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalForeignKeyRelation,
    foreignKeyRelation: {
      ...originalForeignKeyRelation,
      updateAction: 'CASCADE',
    },
  });

  expect(transaction.map(({ args }) => args.sql)).toEqual([
    'ALTER TABLE test_schema.test_table DROP CONSTRAINT IF EXISTS custom_author_reference;',
    'ALTER TABLE test_schema.test_table ADD CONSTRAINT custom_author_reference FOREIGN KEY (test_id) REFERENCES public.authors (id) ON UPDATE CASCADE ON DELETE RESTRICT;',
  ]);
});

test('returns no SQL for an invalid replacement instead of dropping the original', () => {
  expect(
    prepareUpdateForeignKeyConstraintQuery({
      dataSource: 'test_datasource',
      schema: 'test_schema',
      table: 'test_table',
      originalForeignKeyRelation: {
        name: 'custom_reference',
        columns: ['tenant_id', 'parent_id'],
        referencedSchema: 'public',
        referencedTable: 'parents',
        referencedColumns: ['tenant_id', 'id'],
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
      foreignKeyRelation: {
        name: 'custom_reference',
        columns: ['tenant_id', 'parent_id'],
        referencedSchema: 'public',
        referencedTable: 'parents',
        referencedColumns: ['id'],
        updateAction: 'CASCADE',
        deleteAction: 'RESTRICT',
      },
    }),
  ).toEqual([]);
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
