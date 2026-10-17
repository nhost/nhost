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
  it('should drop removed and add new multi-column unique constraints', () => {
    const columns: DatabaseColumn[] = [
      { id: 'a', name: 'a', type: 'text', uniqueConstraints: ['t_a_b_key'] },
      { id: 'b', name: 'b', type: 'text', uniqueConstraints: ['t_a_b_key'] },
      { id: 'c', name: 'c', type: 'text', uniqueConstraints: ['t_c_key'] },
      { id: 'd', name: 'd', type: 'text', uniqueConstraints: ['t_d_e_key'] },
      { id: 'e', name: 'e', type: 'text', uniqueConstraints: ['t_d_e_key'] },
    ];

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable: {
        name: originalTableName,
        primaryKey: [],
        columns,
        uniqueKeys: [
          { name: 't_a_b_key', columns: ['a', 'b'] },
          { columns: ['b', 'c'] },
          { newName: 't_c_e_key', columns: ['c', 'e'] },
        ],
      },
      originalColumns: columns,
      originalForeignKeyRelations: [],
    });

    expect(transaction.map(({ args }) => args.sql)).toEqual([
      'ALTER TABLE public.test_table DROP CONSTRAINT IF EXISTS t_d_e_key;',
      'ALTER TABLE public.test_table ADD UNIQUE (b,c);',
      'ALTER TABLE public.test_table ADD CONSTRAINT t_c_e_key UNIQUE (c,e);',
    ]);
  });

  it('unticking Unique only drops single-column unique constraints', () => {
    const columns: DatabaseColumn[] = [
      { id: 'b', name: 'b', type: 'text', uniqueConstraints: ['t_b_c_key'] },
      {
        id: 'c',
        name: 'c',
        type: 'text',
        isUnique: true,
        uniqueConstraints: ['t_c_key', 't_b_c_key'],
      },
    ];

    const transaction = prepareUpdateTableQuery({
      dataSource: 'default',
      schema: 'public',
      originalTableName,
      updatedTable: {
        name: originalTableName,
        primaryKey: [],
        columns: [columns[0], { ...columns[1], isUnique: false }],
        uniqueKeys: [{ name: 't_b_c_key', columns: ['b', 'c'] }],
      },
      originalColumns: columns,
      originalForeignKeyRelations: [],
    });

    expect(transaction.map(({ args }) => args.sql)).toEqual([
      'ALTER TABLE public.test_table DROP CONSTRAINT IF EXISTS t_c_key;',
    ]);
  });

  it('should prepare a query for renaming the table', () => {
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

  it('should prepare a query for adding a column', () => {
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

  it('should prepare a query for removing a column', () => {
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

  it('should prepare a query for updating a column', () => {
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

  it('should prepare a query for adding a foreign key', () => {
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

  it('should prepare a query for removing a foreign key', () => {
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

  it('should prepare a query for updating a foreign key', () => {
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

  it('should not modify primary keys when they are the same', () => {
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

  it('should handle primary key changes from single to composite', () => {
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

  it('should handle removing primary key entirely', () => {
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
  it('should prepare a query for adding comment to with the old table name', () => {
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

  it('should prepare a query for adding comment to the table', () => {
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
});
