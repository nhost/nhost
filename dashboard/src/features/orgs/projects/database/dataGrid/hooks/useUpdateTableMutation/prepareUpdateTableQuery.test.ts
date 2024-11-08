import type {
  DatabaseColumn,
  DatabaseTable,
  NormalizedQueryDataRow,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import prepareUpdateTableQuery from './prepareUpdateTableQuery';

const originalTable: NormalizedQueryDataRow = {
  table_catalog: 'postgres',
  table_schema: 'public',
  table_name: 'test_table',
  table_type: 'BASE TABLE',
  self_referencing_column_name: null,
  reference_generation: null,
  user_defined_type_catalog: null,
  user_defined_type_schema: null,
  user_defined_type_name: null,
  is_insertable_into: 'YES',
  is_typed: 'NO',
  commit_action: null,
};

const originalColumns: DatabaseColumn[] = [
  {
    id: 'id',
    name: 'id',
    type: { value: 'uuid', label: 'UUID' },
    defaultValue: {
      value: 'gen_random_uuid()',
      label: 'gen_random_uuid()',
    },
    isPrimary: true,
  },
  {
    id: 'author_id',
    name: 'author_id',
    type: { value: 'int4', label: 'int4' },
  },
];

test('should prepare a query for renaming the table', () => {
  const updatedTable: DatabaseTable = {
    name: 'test_table_renamed',
    primaryKey: 'id',
    columns: [
      {
        id: 'id',
        name: 'id',
        type: { value: 'uuid', label: 'UUID' },
        defaultValue: {
          value: 'gen_random_uuid()',
          label: 'gen_random_uuid()',
        },
      },
      {
        id: 'author_id',
        name: 'author_id',
        type: { value: 'int4', label: 'int4' },
      },
    ],
    foreignKeyRelations: [],
  };

  const transaction = prepareUpdateTableQuery({
    dataSource: 'default',
    schema: 'public',
    originalTable,
    updatedTable,
    originalColumns,
    originalForeignKeyRelations: [],
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE public.test_table RENAME TO test_table_renamed;',
  );
});

test('should prepare a query for adding a column', () => {
  const updatedTable: DatabaseTable = {
    name: 'test_table',
    primaryKey: 'id',
    columns: [
      {
        id: 'id',
        name: 'id',
        type: { value: 'uuid', label: 'UUID' },
        defaultValue: {
          value: 'gen_random_uuid()',
          label: 'gen_random_uuid()',
        },
      },
      {
        name: 'author_id',
        type: { value: 'int4', label: 'int4' },
      },
    ],
    foreignKeyRelations: [],
  };

  const transaction = prepareUpdateTableQuery({
    dataSource: 'default',
    schema: 'public',
    originalTable,
    updatedTable,
    originalColumns: originalColumns.filter(
      (column) => column.id !== 'author_id',
    ),
    originalForeignKeyRelations: [],
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE public.test_table ADD author_id int4 NOT NULL;',
  );
});

test('should prepare a query for removing a column', () => {
  const updatedTable: DatabaseTable = {
    name: 'test_table',
    primaryKey: 'id',
    columns: [
      {
        id: 'id',
        name: 'id',
        type: { value: 'uuid', label: 'UUID' },
        defaultValue: {
          value: 'gen_random_uuid()',
          label: 'gen_random_uuid()',
        },
      },
    ],
    foreignKeyRelations: [],
  };

  const transaction = prepareUpdateTableQuery({
    dataSource: 'default',
    schema: 'public',
    originalTable,
    updatedTable,
    originalColumns,
    originalForeignKeyRelations: [],
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE public.test_table DROP COLUMN IF EXISTS author_id;',
  );
});

test('should prepare a query for updating a column', () => {
  const updatedTable: DatabaseTable = {
    name: 'test_table',
    primaryKey: 'id',
    columns: [
      {
        id: 'id',
        name: 'id',
        type: { value: 'uuid', label: 'UUID' },
        defaultValue: {
          value: 'gen_random_uuid()',
          label: 'gen_random_uuid()',
        },
      },
      {
        id: 'author_id',
        name: 'age',
        type: { value: 'int2', label: 'int2' },
      },
    ],
    foreignKeyRelations: [],
  };

  const transaction = prepareUpdateTableQuery({
    dataSource: 'default',
    schema: 'public',
    originalTable,
    updatedTable,
    originalColumns,
    originalForeignKeyRelations: [],
  });

  expect(transaction).toHaveLength(3);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE public.test_table ALTER COLUMN author_id DROP DEFAULT;',
  );
  expect(transaction[1].args.sql).toBe(
    'ALTER TABLE public.test_table ALTER COLUMN author_id TYPE int2 USING author_id::int2;',
  );
  expect(transaction[2].args.sql).toBe(
    'ALTER TABLE public.test_table RENAME COLUMN author_id TO age;',
  );
});

test('should prepare a query for adding a foreign key', () => {
  const updatedTable: DatabaseTable = {
    name: 'test_table',
    primaryKey: 'id',
    columns: [
      {
        id: 'id',
        name: 'id',
        type: { value: 'uuid', label: 'UUID' },
        defaultValue: {
          value: 'gen_random_uuid()',
          label: 'gen_random_uuid()',
        },
      },
      {
        id: 'author_id',
        name: 'author_id',
        type: { value: 'int4', label: 'int4' },
      },
    ],
    foreignKeyRelations: [
      {
        columnName: 'author_id',
        referencedSchema: 'public',
        referencedTable: 'test_table_2',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ],
  };

  const transaction = prepareUpdateTableQuery({
    dataSource: 'default',
    schema: 'public',
    originalTable,
    updatedTable,
    originalColumns,
    originalForeignKeyRelations: [],
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE public.test_table ADD CONSTRAINT test_table_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.test_table_2 (id) ON UPDATE RESTRICT ON DELETE RESTRICT;',
  );
});

test('should prepare a query for removing a foreign key', () => {
  const updatedTable: DatabaseTable = {
    name: 'test_table',
    primaryKey: 'id',
    columns: [
      {
        id: 'id',
        name: 'id',
        type: { value: 'uuid', label: 'UUID' },
        defaultValue: {
          value: 'gen_random_uuid()',
          label: 'gen_random_uuid()',
        },
      },
      {
        id: 'author_id',
        name: 'author_id',
        type: { value: 'int4', label: 'int4' },
      },
    ],
    foreignKeyRelations: [],
  };

  const transaction = prepareUpdateTableQuery({
    dataSource: 'default',
    schema: 'public',
    originalTable,
    updatedTable,
    originalColumns,
    originalForeignKeyRelations: [
      {
        name: 'test_table_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: 'public',
        referencedTable: 'test_table_2',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ],
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE public.test_table DROP CONSTRAINT IF EXISTS test_table_author_id_fkey;',
  );
});

test('should prepare a query for updating a foreign key', () => {
  const updatedTable: DatabaseTable = {
    name: 'test_table',
    primaryKey: 'id',
    columns: [
      {
        id: 'id',
        name: 'id',
        type: { value: 'uuid', label: 'UUID' },
        defaultValue: {
          value: 'gen_random_uuid()',
          label: 'gen_random_uuid()',
        },
      },
      {
        id: 'author_id',
        name: 'author_id',
        type: { value: 'int4', label: 'int4' },
      },
    ],
    foreignKeyRelations: [
      {
        name: 'test_table_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: 'public',
        referencedTable: 'test_table_3',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ],
  };

  const transaction = prepareUpdateTableQuery({
    dataSource: 'default',
    schema: 'public',
    originalTable,
    updatedTable,
    originalColumns,
    originalForeignKeyRelations: [
      {
        name: 'test_table_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: 'public',
        referencedTable: 'test_table_2',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ],
  });

  expect(transaction).toHaveLength(2);
  expect(transaction[0].args.sql).toBe(
    'ALTER TABLE public.test_table DROP CONSTRAINT IF EXISTS test_table_author_id_fkey;',
  );
  expect(transaction[1].args.sql).toBe(
    'ALTER TABLE public.test_table ADD CONSTRAINT test_table_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.test_table_3 (id) ON UPDATE RESTRICT ON DELETE RESTRICT;',
  );
});
