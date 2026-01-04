import * as metadataQuery from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { vi } from 'vitest';
import fetchExistingRelationships from './fetchExistingRelationships';

vi.mock(
  '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery',
  () => ({
    fetchMetadata: vi.fn(),
  }),
);

const TEST_DATA_SOURCE = 'default';
const TEST_SCHEMA = 'public';
const TEST_APP_URL = 'http://localhost';
const TEST_ADMIN_SECRET = 'test-secret';

describe('fetchExistingRelationships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      tables: [],
    });
  });

  it('should fetch existing object relationship from current table', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'author',
              using: {
                foreign_key_constraint_on: 'author_id',
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(1);
    expect(result.has(`${TEST_SCHEMA}.books.author`)).toBe(true);
    expect(result.get(`${TEST_SCHEMA}.books.author`)).toEqual(foreignKeys[0]);
  });

  it('should handle multiple object relationships from current table', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'author',
              using: {
                foreign_key_constraint_on: 'author_id',
              },
            },
            {
              name: 'publisher',
              using: {
                foreign_key_constraint_on: 'publisher_id',
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
      {
        name: 'books_publisher_id_fkey',
        columnName: 'publisher_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'publishers',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(2);
    expect(result.has(`${TEST_SCHEMA}.books.author`)).toBe(true);
    expect(result.has(`${TEST_SCHEMA}.books.publisher`)).toBe(true);
  });

  it('should not match object relationships when column names differ', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'author',
              using: {
                foreign_key_constraint_on: 'different_column',
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(0);
  });

  it('should fetch existing array relationship from referenced table', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
        },
        {
          table: {
            name: 'authors',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          array_relationships: [
            {
              name: 'books',
              using: {
                foreign_key_constraint_on: {
                  column: 'author_id',
                  table: {
                    name: 'books',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(1);
    expect(result.has(`${TEST_SCHEMA}.authors.books`)).toBe(true);
    expect(result.get(`${TEST_SCHEMA}.authors.books`)).toEqual(foreignKeys[0]);
  });

  it('should handle multiple array relationships from referenced table', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
        },
        {
          table: {
            name: 'authors',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          array_relationships: [
            {
              name: 'books',
              using: {
                foreign_key_constraint_on: {
                  column: 'author_id',
                  table: {
                    name: 'books',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
          ],
        },
        {
          table: {
            name: 'publishers',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          array_relationships: [
            {
              name: 'books',
              using: {
                foreign_key_constraint_on: {
                  column: 'publisher_id',
                  table: {
                    name: 'books',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
      {
        name: 'books_publisher_id_fkey',
        columnName: 'publisher_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'publishers',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(2);
    expect(result.has(`${TEST_SCHEMA}.authors.books`)).toBe(true);
    expect(result.has(`${TEST_SCHEMA}.publishers.books`)).toBe(true);
  });

  it('should not match array relationships when table name differs', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
        },
        {
          table: {
            name: 'authors',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          array_relationships: [
            {
              name: 'books',
              using: {
                foreign_key_constraint_on: {
                  column: 'author_id',
                  table: {
                    name: 'different_table',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(0);
  });

  it('should not match array relationships when schema differs', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
        },
        {
          table: {
            name: 'authors',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          array_relationships: [
            {
              name: 'books',
              using: {
                foreign_key_constraint_on: {
                  column: 'author_id',
                  table: {
                    name: 'books',
                    schema: 'different_schema',
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(0);
  });

  it('should not match array relationships when column name differs', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
        },
        {
          table: {
            name: 'authors',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          array_relationships: [
            {
              name: 'books',
              using: {
                foreign_key_constraint_on: {
                  column: 'different_column',
                  table: {
                    name: 'books',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(0);
  });

  it('should fetch existing object relationship from referenced table for one-to-one', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
        },
        {
          table: {
            name: 'book_metadata',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'book',
              using: {
                foreign_key_constraint_on: {
                  column: 'id',
                  table: {
                    name: 'books',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_id_fkey',
        columnName: 'id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'book_metadata',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
        oneToOne: true,
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(1);
    expect(result.has(`${TEST_SCHEMA}.book_metadata.book`)).toBe(true);
    expect(result.get(`${TEST_SCHEMA}.book_metadata.book`)).toEqual(
      foreignKeys[0],
    );
  });

  it('should handle both object relationships for one-to-one constraint', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'book_metadatum',
              using: {
                foreign_key_constraint_on: 'id',
              },
            },
          ],
        },
        {
          table: {
            name: 'book_metadata',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'book',
              using: {
                foreign_key_constraint_on: {
                  column: 'id',
                  table: {
                    name: 'books',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_id_fkey',
        columnName: 'id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'book_metadata',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
        oneToOne: true,
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(2);
    expect(result.has(`${TEST_SCHEMA}.books.book_metadatum`)).toBe(true);
    expect(result.has(`${TEST_SCHEMA}.book_metadata.book`)).toBe(true);
  });

  it('should handle relationships across different schemas', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: 'public',
          },
          configuration: {},
          object_relationships: [
            {
              name: 'category',
              using: {
                foreign_key_constraint_on: 'category_id',
              },
            },
          ],
        },
        {
          table: {
            name: 'categories',
            schema: 'catalog',
          },
          configuration: {},
          array_relationships: [
            {
              name: 'books',
              using: {
                foreign_key_constraint_on: {
                  column: 'category_id',
                  table: {
                    name: 'books',
                    schema: 'public',
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_category_id_fkey',
        columnName: 'category_id',
        referencedSchema: 'catalog',
        referencedTable: 'categories',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: 'public',
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(2);
    expect(result.has('public.books.category')).toBe(true);
    expect(result.has('catalog.categories.books')).toBe(true);
  });
  it('should fetch all relationships (object and array) for multiple foreign keys', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'author',
              using: {
                foreign_key_constraint_on: 'author_id',
              },
            },
            {
              name: 'publisher',
              using: {
                foreign_key_constraint_on: 'publisher_id',
              },
            },
          ],
        },
        {
          table: {
            name: 'authors',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          array_relationships: [
            {
              name: 'books',
              using: {
                foreign_key_constraint_on: {
                  column: 'author_id',
                  table: {
                    name: 'books',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
          ],
        },
        {
          table: {
            name: 'publishers',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          array_relationships: [
            {
              name: 'books',
              using: {
                foreign_key_constraint_on: {
                  column: 'publisher_id',
                  table: {
                    name: 'books',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
      {
        name: 'books_publisher_id_fkey',
        columnName: 'publisher_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'publishers',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(4);
    expect(result.has(`${TEST_SCHEMA}.books.author`)).toBe(true);
    expect(result.has(`${TEST_SCHEMA}.books.publisher`)).toBe(true);
    expect(result.has(`${TEST_SCHEMA}.authors.books`)).toBe(true);
    expect(result.has(`${TEST_SCHEMA}.publishers.books`)).toBe(true);
  });

  it('should handle mixed one-to-many and one-to-one relationships', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'author',
              using: {
                foreign_key_constraint_on: 'author_id',
              },
            },
            {
              name: 'book_metadatum',
              using: {
                foreign_key_constraint_on: 'metadata_id',
              },
            },
          ],
        },
        {
          table: {
            name: 'authors',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          array_relationships: [
            {
              name: 'books',
              using: {
                foreign_key_constraint_on: {
                  column: 'author_id',
                  table: {
                    name: 'books',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
          ],
        },
        {
          table: {
            name: 'book_metadata',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'book',
              using: {
                foreign_key_constraint_on: {
                  column: 'metadata_id',
                  table: {
                    name: 'books',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
      {
        name: 'books_metadata_id_fkey',
        columnName: 'metadata_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'book_metadata',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
        oneToOne: true,
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(4);
    expect(result.has(`${TEST_SCHEMA}.books.author`)).toBe(true);
    expect(result.has(`${TEST_SCHEMA}.books.book_metadatum`)).toBe(true);
    expect(result.has(`${TEST_SCHEMA}.authors.books`)).toBe(true);
    expect(result.has(`${TEST_SCHEMA}.book_metadata.book`)).toBe(true);
  });

  it('should return empty map when no foreign keys provided', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'author',
              using: {
                foreign_key_constraint_on: 'author_id',
              },
            },
          ],
        },
      ],
    });

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys: [],
    });

    expect(result.size).toBe(0);
  });

  it('should return empty map when metadata has no tables', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      tables: undefined,
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(0);
  });

  it('should return empty map when current table not found in metadata', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'different_table',
            schema: TEST_SCHEMA,
          },
          configuration: {},
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(0);
  });

  it('should handle current table with no relationships defined', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(0);
  });

  it('should handle referenced table not found in metadata', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'author',
              using: {
                foreign_key_constraint_on: 'author_id',
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(1);
    expect(result.has(`${TEST_SCHEMA}.books.author`)).toBe(true);
  });

  it('should handle referenced table with no relationships defined', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'author',
              using: {
                foreign_key_constraint_on: 'author_id',
              },
            },
          ],
        },
        {
          table: {
            name: 'authors',
            schema: TEST_SCHEMA,
          },
          configuration: {},
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(1);
    expect(result.has(`${TEST_SCHEMA}.books.author`)).toBe(true);
  });

  it('should handle foreign key with null referenced schema', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'books',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'author',
              using: {
                foreign_key_constraint_on: 'author_id',
              },
            },
          ],
        },
        {
          table: {
            name: 'authors',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          array_relationships: [
            {
              name: 'books',
              using: {
                foreign_key_constraint_on: {
                  column: 'author_id',
                  table: {
                    name: 'books',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'books_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: null,
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(1);
    expect(result.has(`${TEST_SCHEMA}.books.author`)).toBe(true);
  });

  it('should call fetchMetadata with correct parameters', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      tables: [],
    });

    const foreignKeys: ForeignKeyRelation[] = [];

    await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(metadataQuery.fetchMetadata).toHaveBeenCalledTimes(1);
    expect(metadataQuery.fetchMetadata).toHaveBeenCalledWith({
      dataSource: TEST_DATA_SOURCE,
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
    });
  });

  it('should handle multiple object relationships to the same referenced table', async () => {
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      name: TEST_DATA_SOURCE,
      kind: 'postgres',
      tables: [
        {
          table: {
            name: 'orders',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          object_relationships: [
            {
              name: 'customer',
              using: {
                foreign_key_constraint_on: 'customer_id',
              },
            },
            {
              name: 'seller',
              using: {
                foreign_key_constraint_on: 'seller_id',
              },
            },
          ],
        },
        {
          table: {
            name: 'users',
            schema: TEST_SCHEMA,
          },
          configuration: {},
          array_relationships: [
            {
              name: 'orders_as_customer',
              using: {
                foreign_key_constraint_on: {
                  column: 'customer_id',
                  table: {
                    name: 'orders',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
            {
              name: 'orders_as_seller',
              using: {
                foreign_key_constraint_on: {
                  column: 'seller_id',
                  table: {
                    name: 'orders',
                    schema: TEST_SCHEMA,
                  },
                },
              },
            },
          ],
        },
      ],
    });

    const foreignKeys: ForeignKeyRelation[] = [
      {
        name: 'orders_customer_id_fkey',
        columnName: 'customer_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'users',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
      {
        name: 'orders_seller_id_fkey',
        columnName: 'seller_id',
        referencedSchema: TEST_SCHEMA,
        referencedTable: 'users',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ];

    const result = await fetchExistingRelationships({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'orders',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      foreignKeys,
    });

    expect(result.size).toBe(4);
    expect(result.has(`${TEST_SCHEMA}.orders.customer`)).toBe(true);
    expect(result.has(`${TEST_SCHEMA}.orders.seller`)).toBe(true);
    expect(result.has(`${TEST_SCHEMA}.users.orders_as_customer`)).toBe(true);
    expect(result.has(`${TEST_SCHEMA}.users.orders_as_seller`)).toBe(true);
  });
});
