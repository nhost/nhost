import type { DatabaseTable } from '@/features/database/dataGrid/types/dataBrowser';
import { expect, test } from 'vitest';
import prepareCreateTableQuery from './prepareCreateTableQuery';

test('should prepare a simple query', () => {
  const table: DatabaseTable = {
    name: 'test_table',
    columns: [
      {
        name: 'id',
        type: { value: 'uuid', label: 'UUID' },
      },
      {
        name: 'name',
        type: { value: 'text', label: 'Text' },
      },
    ],
    primaryKey: 'id',
  };

  const transaction = prepareCreateTableQuery({
    dataSource: 'default',
    schema: 'public',
    table,
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'CREATE TABLE public.test_table (id uuid NOT NULL, name text NOT NULL, PRIMARY KEY (id));',
  );
});

test('should prepare a query with foreign keys', () => {
  const table: DatabaseTable = {
    name: 'test_table',
    columns: [
      {
        name: 'id',
        type: { value: 'uuid', label: 'UUID' },
      },
      {
        name: 'name',
        type: { value: 'text', label: 'Text' },
      },
      {
        name: 'author_id',
        type: { value: 'uuid', label: 'UUID' },
      },
    ],
    foreignKeyRelations: [
      {
        name: 'test_table_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: 'public',
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ],
    primaryKey: 'id',
  };

  const transaction = prepareCreateTableQuery({
    dataSource: 'default',
    schema: 'public',
    table,
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'CREATE TABLE public.test_table (id uuid NOT NULL, name text NOT NULL, author_id uuid NOT NULL, PRIMARY KEY (id), FOREIGN KEY (author_id) REFERENCES public.authors (id) ON UPDATE RESTRICT ON DELETE RESTRICT);',
  );
});

test('should prepare a query with unique keys', () => {
  const table: DatabaseTable = {
    name: 'test_table',
    columns: [
      {
        name: 'id',
        type: { value: 'uuid', label: 'UUID' },
      },
      {
        name: 'name',
        type: { value: 'text', label: 'Text' },
        isUnique: true,
      },
    ],
    primaryKey: 'id',
  };

  const transaction = prepareCreateTableQuery({
    dataSource: 'default',
    schema: 'public',
    table,
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'CREATE TABLE public.test_table (id uuid NOT NULL, name text UNIQUE NOT NULL, PRIMARY KEY (id));',
  );
});

test('should prepare a query with nullable columns', () => {
  const table: DatabaseTable = {
    name: 'test_table',
    columns: [
      {
        name: 'id',
        type: { value: 'uuid', label: 'UUID' },
      },
      {
        name: 'name',
        type: { value: 'text', label: 'Text' },
        isNullable: true,
      },
      {
        name: 'is_active',
        type: { value: 'bool', label: 'Boolean' },
        isNullable: true,
      },
    ],
    primaryKey: 'id',
  };

  const transaction = prepareCreateTableQuery({
    dataSource: 'default',
    schema: 'public',
    table,
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'CREATE TABLE public.test_table (id uuid NOT NULL, name text, is_active bool, PRIMARY KEY (id));',
  );
});

test('should prepare a query with default values', () => {
  const table: DatabaseTable = {
    name: 'test_table',
    columns: [
      {
        name: 'id',
        type: { value: 'uuid', label: 'UUID' },
        // this is a default value preset
        defaultValue: {
          value: 'gen_random_uuid()',
          label: 'gen_random_uuid()',
        },
      },
      {
        name: 'name',
        type: { value: 'text', label: 'Text' },
        isNullable: true,
      },
      {
        name: 'is_active',
        type: { value: 'bool', label: 'Boolean' },
        isNullable: true,
        // this is a custom default value
        defaultValue: { value: 'true', label: 'true', custom: true },
      },
    ],
    primaryKey: 'id',
  };

  const transaction = prepareCreateTableQuery({
    dataSource: 'default',
    schema: 'public',
    table,
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    "CREATE TABLE public.test_table (id uuid DEFAULT gen_random_uuid() NOT NULL, name text, is_active bool DEFAULT 'true', PRIMARY KEY (id));",
  );
});

test('should prepare a query with an identity column', () => {
  const table: DatabaseTable = {
    name: 'test_table',
    columns: [
      {
        name: 'id',
        type: { value: 'int4', label: 'Integer' },
      },
      {
        name: 'name',
        type: { value: 'text', label: 'Text' },
        isNullable: true,
      },
      {
        name: 'is_active',
        type: { value: 'bool', label: 'Boolean' },
        isNullable: true,
        defaultValue: { value: 'true', label: 'true' },
      },
    ],
    primaryKey: 'id',
    identityColumn: 'id',
  };

  const transaction = prepareCreateTableQuery({
    dataSource: 'default',
    schema: 'public',
    table,
  });

  expect(transaction).toHaveLength(1);
  expect(transaction[0].args.sql).toBe(
    'CREATE TABLE public.test_table (id int4 GENERATED ALWAYS AS IDENTITY, name text, is_active bool DEFAULT true, PRIMARY KEY (id));',
  );
});
