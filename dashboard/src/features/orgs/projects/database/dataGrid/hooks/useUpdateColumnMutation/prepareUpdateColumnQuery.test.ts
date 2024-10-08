import { expect, test } from 'vitest';
import prepareUpdateColumnQuery from './prepareUpdateColumnQuery';

test('should not contain any queries if the updated column does not have any changes', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      defaultValue: { value: 'test', label: 'test' },
      isNullable: true,
      isUnique: false,
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      defaultValue: { value: 'test', label: 'test' },
      isNullable: true,
      isUnique: false,
    },
  });

  expect(transaction).toHaveLength(0);
});

test("should contain a query to rename the column if the updated column's name has changed", () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
    },
    column: {
      id: 'name',
      name: 'new_name',
      type: { value: 'text', label: 'text' },
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE test_schema.test_table RENAME COLUMN name TO new_name;',
  );
});

test("should contain queries to drop the default value and to change the type if the updated column's type has changed", () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'int4', label: 'integer' },
    },
  });

  expect(transaction).toHaveLength(2);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE test_schema.test_table ALTER COLUMN name DROP DEFAULT;',
  );
  expect(transaction[1].args.sql).toBe(
    'ALTER TABLE test_schema.test_table ALTER COLUMN name TYPE int4 USING name::int4;',
  );
});

test('should contain a query to drop the default value if the updated column has no default value', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      defaultValue: { value: 'test', label: 'test' },
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      defaultValue: null,
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE test_schema.test_table ALTER COLUMN name DROP DEFAULT;',
  );
});

test("should contain a query to set the default value to the updated column's literal default value", () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      defaultValue: { value: 'test', label: 'test' },
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      defaultValue: { value: 'new_test', label: 'new_test', custom: true },
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    "ALTER TABLE test_schema.test_table ALTER COLUMN name SET DEFAULT 'new_test';",
  );
});

test('should contain a query to set the default value if the type changed from custom to non-custom or vice versa', () => {
  // change default value from custom (literal) 'version()' to non-custom
  // (non-literal) 'version()'
  const customToNonCustomTransaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      defaultValue: { value: 'version()', label: 'version()', custom: true },
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      defaultValue: { value: 'version()', label: 'version()' },
    },
  });

  expect(customToNonCustomTransaction).toHaveLength(1);
  expect(customToNonCustomTransaction[0].args.sql).toBe(
    'ALTER TABLE test_schema.test_table ALTER COLUMN name SET DEFAULT version();',
  );

  // change default value from non-custom (non-literal) version() to custom
  // (literal) version()
  const nonCustomToCustomTransaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      defaultValue: { value: 'version()', label: 'version()' },
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      defaultValue: { value: 'version()', label: 'version()', custom: true },
    },
  });

  expect(nonCustomToCustomTransaction).toHaveLength(1);
  expect(nonCustomToCustomTransaction[0].args.sql).toBe(
    "ALTER TABLE test_schema.test_table ALTER COLUMN name SET DEFAULT 'version()';",
  );
});

test('should contain a query to set the comment to null if the updated column has no comments', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      comment: 'test comment',
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'COMMENT ON COLUMN test_schema.test_table.name IS NULL;',
  );
});

test('should contain a query to set the comment if the updated column any comments', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      comment: 'test comment',
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    "COMMENT ON COLUMN test_schema.test_table.name IS 'test comment';",
  );
});

test('should contain a query to set the comment if the update column has a different comment than the original column', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      comment: 'original comment',
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      comment: 'test comment',
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    "COMMENT ON COLUMN test_schema.test_table.name IS 'test comment';",
  );
});

test('should contain a query to drop "not null" constraint if the updated column is nullable', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      isNullable: false,
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      isNullable: true,
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE test_schema.test_table ALTER COLUMN name DROP NOT NULL;',
  );
});

test('should contain a query to add a "not null" constraint if the updated column is not nullable anymore', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      isNullable: true,
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      isNullable: false,
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE test_schema.test_table ALTER COLUMN name SET NOT NULL;',
  );
});

test('should contain a query to add a unique constraint if the updated column should be unique', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      isUnique: false,
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      isUnique: true,
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE test_schema.test_table ADD CONSTRAINT test_table_name_unique UNIQUE (name);',
  );
});

test('should contain a query to drop unique constraint if the updated column should not be unique anymore', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      isUnique: true,
      uniqueConstraints: ['test_table_test_column_unique'],
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      isUnique: false,
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE test_schema.test_table DROP CONSTRAINT IF EXISTS test_table_test_column_unique;',
  );
});

test('should contain a query to generate column as identity if the updated column should be used as identity', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      isIdentity: false,
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      isIdentity: true,
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE test_schema.test_table ALTER COLUMN name ADD GENERATED BY DEFAULT AS IDENTITY;',
  );
});

test('should contain a query to drop identity if the updated column should not be used as identity', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'test_datasource',
    schema: 'test_schema',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      isIdentity: true,
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      isIdentity: false,
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE test_schema.test_table ALTER COLUMN name DROP IDENTITY IF EXISTS;',
  );
});

test('should prepare a query when a foreign key should be created', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'default',
    schema: 'public',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      foreignKeyRelation: {
        name: 'test_table_name_fkey',
        columnName: 'name',
        referencedSchema: 'public',
        referencedTable: 'test_table',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE public.test_table ADD CONSTRAINT test_table_name_fkey FOREIGN KEY (name) REFERENCES public.test_table (id) ON UPDATE RESTRICT ON DELETE RESTRICT;',
  );
});

test('should prepare a query when the foreign key should be removed', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'default',
    schema: 'public',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      foreignKeyRelation: {
        name: 'test_table_name_fkey',
        columnName: 'name',
        referencedSchema: 'public',
        referencedTable: 'test_table',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      foreignKeyRelation: null,
    },
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE public.test_table DROP CONSTRAINT IF EXISTS test_table_name_fkey;',
  );
});

test('should prepare two queries when the foreign key should be updated', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'default',
    schema: 'public',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      foreignKeyRelation: {
        name: 'test_table_name_fkey',
        columnName: 'name',
        referencedSchema: 'public',
        referencedTable: 'test_table',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      foreignKeyRelation: {
        name: 'test_table_name_fkey',
        columnName: 'name',
        referencedSchema: 'public',
        referencedTable: 'test_table_2',
        referencedColumn: 'id_2',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    },
  });

  expect(transaction).toHaveLength(2);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE public.test_table DROP CONSTRAINT IF EXISTS test_table_name_fkey;',
  );
  expect(transaction[1].args.sql).toBe(
    'ALTER TABLE public.test_table ADD CONSTRAINT test_table_name_fkey FOREIGN KEY (name) REFERENCES public.test_table_2 (id_2) ON UPDATE RESTRICT ON DELETE RESTRICT;',
  );
});

test('should prepare two queries when foreign key is changed but it should be skipped', () => {
  const transaction = prepareUpdateColumnQuery({
    dataSource: 'default',
    schema: 'public',
    table: 'test_table',
    originalColumn: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      foreignKeyRelation: {
        name: 'test_table_name_fkey',
        columnName: 'name',
        referencedSchema: 'public',
        referencedTable: 'test_table',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    },
    column: {
      id: 'name',
      name: 'name',
      type: { value: 'text', label: 'text' },
      foreignKeyRelation: {
        name: 'test_table_name_fkey',
        columnName: 'name',
        referencedSchema: 'public',
        referencedTable: 'test_table_2',
        referencedColumn: 'id_2',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    },
    enableForeignKeys: false,
  });

  expect(transaction).toHaveLength(0);
});
