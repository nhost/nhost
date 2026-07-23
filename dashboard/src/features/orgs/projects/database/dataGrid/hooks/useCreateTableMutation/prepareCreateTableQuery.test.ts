import type { DatabaseTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import prepareCreateTableQuery from './prepareCreateTableQuery';

describe('prepareCreateTableQuery', () => {
  it('should prepare a simple query', () => {
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

  it('should prepare a query with foreign keys', () => {
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
          columns: ['author_id'],
          referencedSchema: 'public',
          referencedTable: 'authors',
          referencedColumns: ['id'],
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

  it('should prepare a query with a composite foreign key', () => {
    const table: DatabaseTable = {
      name: 'test_table',
      columns: [
        {
          name: 'id',
          type: 'uuid',
        },
        {
          name: 'author_id',
          type: 'uuid',
        },
        {
          name: 'editor_id',
          type: 'uuid',
        },
      ],
      foreignKeyRelations: [
        {
          name: 'test_table_author_id_editor_id_fkey',
          columns: ['author_id', 'editor_id'],
          referencedSchema: 'public',
          referencedTable: 'authors',
          referencedColumns: ['id', 'uuid'],
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
      'CREATE TABLE public.test_table (id uuid NOT NULL, author_id uuid NOT NULL, editor_id uuid NOT NULL, PRIMARY KEY (id), FOREIGN KEY (author_id,editor_id) REFERENCES public.authors (id,uuid) ON UPDATE RESTRICT ON DELETE RESTRICT);',
    );
  });

  it('uses canonical constraints instead of the legacy column unique flag', () => {
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
      uniqueConstraints: [
        {
          id: 'name-unique',
          originalName: '',
          name: '',
          columns: ['name'],
        },
      ],
    };

    const transaction = prepareCreateTableQuery({
      dataSource: 'default',
      schema: 'public',
      table,
    });

    expect(transaction).toHaveLength(1);
    expect(transaction[0].args.sql).toBe(
      'CREATE TABLE public.test_table (id uuid NOT NULL, name text NOT NULL, PRIMARY KEY (id), UNIQUE (name));',
    );
  });

  it('should prepare table-level named and unnamed unique constraints', () => {
    const table: DatabaseTable = {
      name: 'test_table',
      columns: [
        {
          name: 'tenant id',
          type: 'uuid',
        },
        {
          name: 'email',
          type: 'text',
        },
      ],
      primaryKey: [],
      uniqueConstraints: [
        {
          id: 'named',
          originalName: '',
          name: 'tenant "email" key',
          columns: ['tenant id', 'email'],
        },
        {
          id: 'unnamed',
          originalName: '',
          name: '',
          columns: ['email'],
        },
      ],
    };

    const transaction = prepareCreateTableQuery({
      dataSource: 'default',
      schema: 'public',
      table,
    });

    expect(transaction[0].args.sql).toBe(
      'CREATE TABLE public.test_table ("tenant id" uuid NOT NULL, email text NOT NULL, CONSTRAINT "tenant ""email"" key" UNIQUE ("tenant id",email), UNIQUE (email));',
    );
  });

  it('should prepare a query with nullable columns', () => {
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

  it('should prepare a query with default values', () => {
    const table: DatabaseTable = {
      name: 'test_table',
      columns: [
        {
          name: 'id',
          type: 'uuid',
          defaultValue: 'gen_random_uuid()',
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
          defaultValue: "'true'",
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

  it('should emit each default verbatim, distinguishing a quoted literal from a bare function', () => {
    const table: DatabaseTable = {
      name: 'test_table',
      columns: [
        {
          name: 'as_literal',
          type: 'text',
          isNullable: true,
          defaultValue: "'version()'",
        },
        {
          name: 'as_function',
          type: 'text',
          isNullable: true,
          defaultValue: 'version()',
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

  it('should prepare a query with an empty-string default for text columns', () => {
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
          defaultValue: "''",
        },
        {
          name: 'nickname',
          type: 'character varying',
          defaultValue: "''",
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
      "CREATE TABLE public.test_table (id uuid NOT NULL, name text DEFAULT '' NOT NULL, nickname character varying DEFAULT '' NOT NULL, PRIMARY KEY (id));",
    );
  });
  it('should prepare a query with an identity column', () => {
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
          defaultValue: "'true'",
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
  it('should prepare a query with no primary key', () => {
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

  it('should add comments to columns', () => {
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
