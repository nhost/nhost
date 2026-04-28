import { expect, test } from 'vitest';
import type { DatabaseTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import prepareCreateTableQuery from './prepareCreateTableQuery';

describe('prepareCreateTableQuery', () => {
  test('should prepare a simple query', () => {
    const table: DatabaseTable = {
      name: 'test_table',
      columns: [
        {
          name: 'id',
          type: 'uuid',
        },
        {
          name: 'name',
          type: 'text',
        },
      ],
      primaryKey: ['id'],
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
          type: 'uuid',
        },
        {
          name: 'name',
          type: 'text',
        },
        {
          name: 'author_id',
          type: 'uuid',
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
      primaryKey: ['id'],
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
          type: 'uuid',
        },
        {
          name: 'name',
          type: 'text',
          isUnique: true,
        },
      ],
      primaryKey: ['id'],
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
          type: 'uuid',
        },
        {
          name: 'name',
          type: 'text',
          isNullable: true,
        },
        {
          name: 'is_active',
          type: 'bool',
          isNullable: true,
        },
      ],
      primaryKey: ['id'],
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
          type: 'uuid',
          defaultValue: { value: 'gen_random_uuid()', custom: false },
        },
        {
          name: 'name',
          type: 'text',
          isNullable: true,
        },
        {
          name: 'is_active',
          type: 'bool',
          isNullable: true,
          defaultValue: { value: 'true', custom: true },
        },
      ],
      primaryKey: ['id'],
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

  test('should escape a literal default whose value collides with a function name', () => {
    const table: DatabaseTable = {
      name: 'test_table',
      columns: [
        {
          name: 'as_literal',
          type: 'text',
          isNullable: true,
          defaultValue: { value: 'version()', custom: true },
        },
        {
          name: 'as_function',
          type: 'text',
          isNullable: true,
          defaultValue: { value: 'version()', custom: false },
        },
      ],
      primaryKey: [],
    };

    const transaction = prepareCreateTableQuery({
      dataSource: 'default',
      schema: 'public',
      table,
    });

    expect(transaction[0].args.sql).toBe(
      "CREATE TABLE public.test_table (as_literal text DEFAULT 'version()', as_function text DEFAULT version());",
    );
  });

  test('should prepare a query with an identity column', () => {
    const table: DatabaseTable = {
      name: 'test_table',
      columns: [
        {
          name: 'id',
          type: 'int4',
        },
        {
          name: 'name',
          type: 'text',
          isNullable: true,
        },
        {
          name: 'is_active',
          type: 'bool',
          isNullable: true,
          defaultValue: { value: 'true', custom: true },
        },
      ],
      primaryKey: ['id'],
      identityColumn: 'id',
    };

    const transaction = prepareCreateTableQuery({
      dataSource: 'default',
      schema: 'public',
      table,
    });

    expect(transaction).toHaveLength(1);
    expect(transaction[0].args.sql).toBe(
      "CREATE TABLE public.test_table (id int4 GENERATED ALWAYS AS IDENTITY, name text, is_active bool DEFAULT 'true', PRIMARY KEY (id));",
    );
  });
  test('should prepare a query with no primary key', () => {
    const table: DatabaseTable = {
      name: 'test_table',
      primaryKey: [],
      columns: [
        {
          name: 'id',
          type: 'uuid',
        },
        {
          name: 'name',
          type: 'character varying(10)',
        },
      ],
      // No primaryKey property set
    };

    const transaction = prepareCreateTableQuery({
      dataSource: 'default',
      schema: 'public',
      table,
    });

    expect(transaction).toHaveLength(1);
    expect(transaction[0].args.sql).toBe(
      'CREATE TABLE public.test_table (id uuid NOT NULL, name character varying(10) NOT NULL);',
    );
  });

  test('should add comments to columns', () => {
    const table: DatabaseTable = {
      name: 'test_table',
      columns: [
        {
          name: 'id',
          type: 'uuid',
          comment: 'Primary key comment',
        },
        {
          name: 'name',
          type: 'text',
          comment: 'Text comment',
        },
      ],
      primaryKey: ['id'],
    };

    const transaction = prepareCreateTableQuery({
      dataSource: 'default',
      schema: 'public',
      table,
    });

    expect(transaction).toHaveLength(3);
    expect(transaction[1].args.sql).toBe(
      "COMMENT ON COLUMN public.test_table.id is 'Primary key comment';",
    );
    expect(transaction[2].args.sql).toBe(
      "COMMENT ON COLUMN public.test_table.name is 'Text comment';",
    );
  });
});
