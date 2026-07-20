import type {
  DatabaseColumn,
  DatabaseTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import prepareUpdateTableQuery from './prepareUpdateTableQuery';

const originalTableName = 'test_table';

const originalColumns: DatabaseColumn[] = [
  {
    id: 'id',
    name: 'id',
    type: 'uuid',
    defaultValue: 'gen_random_uuid()',
    isPrimary: true,
  },
  {
    id: 'author_id',
    name: 'author_id',
    type: 'int4',
  },
];

describe('prepareUpdateTableQuery', () => {
  test('should prepare a query for renaming the table', () => {
    const updatedTable: DatabaseTable = {
      name: 'test_table_renamed',
      primaryKey: ['id'],
      columns: [
        {
          id: 'id',
          name: 'id',
          type: 'uuid',
          defaultValue: 'gen_random_uuid()',
        },
        {
          id: 'author_id',
          name: 'author_id',
          type: 'int4',
        },
      ],
      foreignKeyRelations: [],
    };

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
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
      primaryKey: ['id'],
      columns: [
        {
          id: 'id',
          name: 'id',
          type: 'uuid',
          defaultValue: 'gen_random_uuid()',
        },
        {
          name: 'author_id',
          type: 'int4',
        },
      ],
      foreignKeyRelations: [],
    };

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
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
      primaryKey: ['id'],
      columns: [
        {
          id: 'id',
          name: 'id',
          type: 'uuid',
          defaultValue: 'gen_random_uuid()',
        },
      ],
      foreignKeyRelations: [],
    };

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
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
      primaryKey: ['id'],
      columns: [
        {
          id: 'id',
          name: 'id',
          type: 'uuid',
          defaultValue: 'gen_random_uuid()',
        },
        {
          id: 'author_id',
          name: 'age',
          type: 'numeric(10,2)',
        },
      ],
      foreignKeyRelations: [],
    };

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable,
      originalColumns,
      originalForeignKeyRelations: [],
    });

    expect(transaction).toHaveLength(3);
    expect(transaction[0].args.sql).toBe(
      'ALTER TABLE public.test_table ALTER COLUMN author_id DROP DEFAULT;',
    );
    expect(transaction[1].args.sql).toBe(
      'ALTER TABLE public.test_table ALTER COLUMN author_id TYPE numeric(10,2) USING author_id::numeric(10,2);',
    );
    expect(transaction[2].args.sql).toBe(
      'ALTER TABLE public.test_table RENAME COLUMN author_id TO age;',
    );
  });

  test('should prepare a query for adding a foreign key', () => {
    const updatedTable: DatabaseTable = {
      name: 'test_table',
      primaryKey: ['id'],
      columns: [
        {
          id: 'id',
          name: 'id',
          type: 'uuid',
          defaultValue: 'gen_random_uuid()',
        },
        {
          id: 'author_id',
          name: 'author_id',
          type: 'int4',
        },
      ],
      foreignKeyRelations: [
        {
          columns: ['author_id'],
          referencedSchema: 'public',
          referencedTable: 'test_table_2',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    };

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
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
      primaryKey: ['id'],
      columns: [
        {
          id: 'id',
          name: 'id',
          type: 'uuid',
          defaultValue: 'gen_random_uuid()',
        },
        {
          id: 'author_id',
          name: 'author_id',
          type: 'int4',
        },
      ],
      foreignKeyRelations: [],
    };

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable,
      originalColumns,
      originalForeignKeyRelations: [
        {
          name: 'test_table_author_id_fkey',
          columns: ['author_id'],
          referencedSchema: 'public',
          referencedTable: 'test_table_2',
          referencedColumns: ['id'],
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
      primaryKey: ['id'],
      columns: [
        {
          id: 'id',
          name: 'id',
          type: 'uuid',
          defaultValue: 'gen_random_uuid()',
        },
        {
          id: 'author_id',
          name: 'author_id',
          type: 'int4',
        },
      ],
      foreignKeyRelations: [
        {
          name: 'test_table_author_id_fkey',
          columns: ['author_id'],
          referencedSchema: 'public',
          referencedTable: 'test_table_3',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    };

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable,
      originalColumns,
      originalForeignKeyRelations: [
        {
          name: 'test_table_author_id_fkey',
          columns: ['author_id'],
          referencedSchema: 'public',
          referencedTable: 'test_table_2',
          referencedColumns: ['id'],
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

  test('should not modify primary keys when they are the same', () => {
    const originalColumnsWithPK: DatabaseColumn[] = [
      {
        id: 'id',
        name: 'id',
        type: 'uuid',
        isPrimary: true,
        primaryConstraints: ['test_table_pkey'],
      },
      {
        id: 'author_id',
        name: 'author_id',
        type: 'int4',
      },
    ];

    const updatedTable: DatabaseTable = {
      name: 'test_table',
      primaryKey: ['id'],
      columns: [
        {
          id: 'id',
          name: 'id',
          type: 'uuid',
        },
        {
          id: 'author_id',
          name: 'author_id',
          type: 'int4',
        },
      ],
      foreignKeyRelations: [],
    };

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable,
      originalColumns: originalColumnsWithPK,
      originalForeignKeyRelations: [],
    });

    // Should not contain any PRIMARY KEY related queries
    const primaryKeyQueries = transaction.filter(
      (query) =>
        query.args.sql.includes('PRIMARY KEY') ||
        query.args.sql.includes('DROP CONSTRAINT'),
    );
    expect(primaryKeyQueries).toHaveLength(0);
  });

  test('should handle primary key changes from single to composite', () => {
    const originalColumnsWithPK: DatabaseColumn[] = [
      {
        id: 'id',
        name: 'id',
        type: 'uuid',
        isPrimary: true,
        primaryConstraints: ['test_table_pkey'],
      },
      {
        id: 'author_id',
        name: 'author_id',
        type: 'int4',
      },
    ];

    const updatedTable: DatabaseTable = {
      name: 'test_table',
      primaryKey: ['id', 'author_id'],
      columns: [
        {
          id: 'id',
          name: 'id',
          type: 'uuid',
        },
        {
          id: 'author_id',
          name: 'author_id',
          type: 'int4',
        },
      ],
      foreignKeyRelations: [],
    };

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable,
      originalColumns: originalColumnsWithPK,
      originalForeignKeyRelations: [],
    });

    // Should drop old constraint and add new composite primary key
    expect(transaction).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          args: expect.objectContaining({
            sql: 'ALTER TABLE public.test_table DROP CONSTRAINT IF EXISTS test_table_pkey;',
          }),
        }),
        expect.objectContaining({
          args: expect.objectContaining({
            sql: 'ALTER TABLE public.test_table ADD PRIMARY KEY (id, author_id);',
          }),
        }),
      ]),
    );
  });

  test('should handle removing primary key entirely', () => {
    const originalColumnsWithPK: DatabaseColumn[] = [
      {
        id: 'id',
        name: 'id',
        type: 'uuid',
        isPrimary: true,
        primaryConstraints: ['test_table_pkey'],
      },
      {
        id: 'author_id',
        name: 'author_id',
        type: 'int4',
      },
    ];

    const updatedTable: DatabaseTable = {
      name: 'test_table',
      primaryKey: [],
      columns: [
        {
          id: 'id',
          name: 'id',
          type: 'uuid',
        },
        {
          id: 'author_id',
          name: 'author_id',
          type: 'int4',
        },
      ],
      foreignKeyRelations: [],
    };

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable,
      originalColumns: originalColumnsWithPK,
      originalForeignKeyRelations: [],
    });

    // Should only drop the constraint, not add a new one
    const dropConstraintQuery = transaction.find((query) =>
      query.args.sql.includes('DROP CONSTRAINT IF EXISTS test_table_pkey'),
    );
    const addPrimaryKeyQuery = transaction.find((query) =>
      query.args.sql.includes('ADD PRIMARY KEY'),
    );

    expect(dropConstraintQuery).toBeDefined();
    expect(addPrimaryKeyQuery).toBeUndefined();
  });
  test('should prepare a query for adding comment to with the old table name', () => {
    const updatedTable: DatabaseTable = {
      name: 'test_table_renamed',
      primaryKey: ['id'],
      columns: [
        {
          id: 'id',
          name: 'id',
          type: 'uuid',
          defaultValue: 'gen_random_uuid()',
        },
        {
          id: 'author_id',
          name: 'author_id',
          type: 'int4',
          comment: 'Author id',
        },
      ],
      foreignKeyRelations: [],
    };

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable,
      originalColumns,
      originalForeignKeyRelations: [],
    });

    expect(transaction).toHaveLength(2);
    expect(transaction[0].args.sql).toBe(
      "COMMENT ON COLUMN public.test_table.author_id IS 'Author id';",
    );
  });

  test('should prepare a query for adding comment to the table', () => {
    const updatedTable: DatabaseTable = {
      name: 'test_table',
      primaryKey: ['id'],
      columns: originalColumns.map((c, index) => ({
        ...c,
        comment: `comment ${index}`,
      })),
      foreignKeyRelations: [],
    };

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable,
      originalColumns,
      originalForeignKeyRelations: [],
    });

    expect(transaction).toHaveLength(2);
    expect(transaction[0].args.sql).toBe(
      "COMMENT ON COLUMN public.test_table.id IS 'comment 0';",
    );
    expect(transaction[1].args.sql).toBe(
      "COMMENT ON COLUMN public.test_table.author_id IS 'comment 1';",
    );
  });

  test('serializes canonical UNIQUE constraints without legacy duplicate SQL', () => {
    const updatedTable: DatabaseTable = {
      name: originalTableName,
      primaryKey: ['id'],
      columns: originalColumns.map((column) => ({
        ...column,
        isUnique: column.name === 'author_id',
      })),
      foreignKeyRelations: [],
      originalUniqueConstraints: [],
      uniqueConstraints: [
        {
          id: 'author-key',
          originalName: '',
          name: 'author_key',
          columns: ['author_id'],
        },
      ],
    };

    const sql = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable,
      originalColumns,
      originalForeignKeyRelations: [],
    }).map((query) => query.args.sql);

    expect(sql).toEqual([
      'ALTER TABLE public.test_table ADD CONSTRAINT author_key UNIQUE (author_id);',
    ]);
  });

  test('does not rebuild an unchanged UNIQUE constraint when its column is renamed', () => {
    const originalUniqueConstraint = {
      id: 'author-key',
      originalName: 'author_key',
      name: 'author_key',
      columns: ['author_id'],
    };
    const updatedTable: DatabaseTable = {
      name: originalTableName,
      primaryKey: ['id'],
      columns: originalColumns.map((column) =>
        column.id === 'author_id'
          ? { ...column, name: 'writer_id' }
          : { ...column },
      ),
      foreignKeyRelations: [],
      originalUniqueConstraints: [originalUniqueConstraint],
      uniqueConstraints: [
        { ...originalUniqueConstraint, columns: ['writer_id'] },
      ],
    };

    const sql = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable,
      originalColumns,
      originalForeignKeyRelations: [],
    }).map((query) => query.args.sql);

    expect(sql).toEqual([
      'ALTER TABLE public.test_table RENAME COLUMN author_id TO writer_id;',
    ]);
  });

  test('renames colliding UNIQUE constraints without dropping or recreating them', () => {
    const first = {
      id: 'first',
      originalName: 'first_key',
      name: 'first_key',
      columns: ['id'],
    };
    const second = {
      id: 'second',
      originalName: 'second_key',
      name: 'second_key',
      columns: ['author_id'],
    };
    const updatedTable: DatabaseTable = {
      name: originalTableName,
      primaryKey: ['id'],
      columns: originalColumns,
      foreignKeyRelations: [],
      originalUniqueConstraints: [first, second],
      uniqueConstraints: [
        { ...first, name: 'second_key' },
        { ...second, name: 'first_key' },
      ],
    };

    const sql = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable,
      originalColumns,
      originalForeignKeyRelations: [],
    }).map((query) => query.args.sql);

    expect(sql).toHaveLength(3);
    expect(sql.every((query) => query.includes('RENAME CONSTRAINT'))).toBe(
      true,
    );
    expect(sql.join(' ')).not.toContain('DROP CONSTRAINT');
    expect(sql.join(' ')).not.toContain('ADD CONSTRAINT');
  });

  test('drops local FK dependencies before type and key changes and recreates them after', () => {
    const relation = {
      name: 'test_table_author_id_fkey',
      columns: ['author_id'],
      referencedSchema: 'public',
      referencedTable: 'test_table',
      referencedColumns: ['author_id'],
      updateAction: 'CASCADE' as const,
      deleteAction: 'CASCADE' as const,
    };
    const originalUniqueConstraint = {
      id: 'author-key',
      originalName: 'author_key',
      name: 'author_key',
      columns: ['author_id'],
    };
    const updatedTable: DatabaseTable = {
      name: originalTableName,
      primaryKey: ['id'],
      columns: originalColumns.map((column) =>
        column.id === 'author_id' ? { ...column, type: 'int8' } : column,
      ),
      foreignKeyRelations: [relation],
      originalUniqueConstraints: [originalUniqueConstraint],
      uniqueConstraints: [
        { ...originalUniqueConstraint, columns: ['id', 'author_id'] },
      ],
    };

    const sql = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable,
      originalColumns,
      originalForeignKeyRelations: [relation],
    }).map((query) => query.args.sql);

    expect(sql[0]).toContain(
      'DROP CONSTRAINT IF EXISTS test_table_author_id_fkey',
    );
    expect(sql[1]).toBe(
      'ALTER TABLE public.test_table DROP CONSTRAINT author_key;',
    );
    expect(
      sql.findIndex((query) => query.includes('TYPE int8')),
    ).toBeGreaterThan(1);
    expect(sql.at(-2)).toBe(
      'ALTER TABLE public.test_table ADD CONSTRAINT author_key UNIQUE (id,author_id);',
    );
    expect(sql.at(-1)).toContain(
      'ADD CONSTRAINT test_table_author_id_fkey FOREIGN KEY',
    );
    expect(sql.at(-1)).toContain('ON UPDATE CASCADE ON DELETE CASCADE');
    expect(sql.join(' ')).not.toMatch(/DROP[^;]*CASCADE/);
  });

  test('rebuilds an unchanged outbound FK around a participating local type change', () => {
    const relation = {
      name: 'test_table_author_id_fkey',
      columns: ['author_id'],
      referencedSchema: 'public',
      referencedTable: 'authors',
      referencedColumns: ['id'],
      updateAction: 'RESTRICT' as const,
      deleteAction: 'RESTRICT' as const,
    };
    const updatedTable: DatabaseTable = {
      name: originalTableName,
      primaryKey: ['id'],
      columns: originalColumns.map((column) =>
        column.id === 'author_id' ? { ...column, type: 'int8' } : column,
      ),
      foreignKeyRelations: [relation],
    };

    const sql = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable,
      originalColumns,
      originalForeignKeyRelations: [relation],
    }).map((query) => query.args.sql);

    expect(sql[0]).toContain(
      'DROP CONSTRAINT IF EXISTS test_table_author_id_fkey',
    );
    expect(sql[2]).toContain('TYPE int8');
    expect(sql.at(-1)).toContain(
      'ADD CONSTRAINT test_table_author_id_fkey FOREIGN KEY',
    );
  });

  test('leaves unchanged keys untouched so external inbound FKs are not disturbed', () => {
    const constraint = {
      id: 'author-key',
      originalName: 'author_key',
      name: 'author_key',
      columns: ['author_id'],
    };
    const updatedTable: DatabaseTable = {
      name: originalTableName,
      primaryKey: ['id'],
      columns: originalColumns,
      foreignKeyRelations: [],
      originalUniqueConstraints: [constraint],
      uniqueConstraints: [constraint],
    };

    expect(
      prepareUpdateTableQuery({
        dataSource: 'default',
        schema: 'public',
        originalTableName,
        updatedTable,
        originalColumns,
        originalForeignKeyRelations: [],
      }),
    ).toHaveLength(0);
  });
});
