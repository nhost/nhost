import * as exportMetadataUtils from '@/features/orgs/projects/common/utils/fetchExportMetadata';
import prepareTrackForeignKeyRelationsMetadata from './prepareTrackForeignKeyRelationsMetadata';

// Mock the fetchExportMetadata module
vi.mock('@/features/orgs/projects/common/utils/fetchExportMetadata', () => ({
  fetchExportMetadata: vi.fn(),
}));

const TEST_DATA_SOURCE = 'default';
const TEST_SCHEMA = 'public';
const TEST_APP_URL = 'http://localhost';
const TEST_ADMIN_SECRET = 'test-secret';

describe('prepareTrackForeignKeyRelationsMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exportMetadataUtils.fetchExportMetadata).mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
            name: 'default',
            kind: 'postgres',
            tables: [],
          },
        ],
      },
    });
  });

  it('should prepare both object and array relationships for a one-to-many relation', async () => {
    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'authors_author_id_fkey',
          columns: ['author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(2);

    expect(response[0]).toEqual({
      type: 'pg_create_object_relationship',
      args: {
        source: TEST_DATA_SOURCE,
        table: {
          name: 'books',
          schema: TEST_SCHEMA,
        },
        name: 'author',
        using: {
          foreign_key_constraint_on: 'author_id',
        },
      },
    });

    expect(response[1]).toEqual({
      type: 'pg_create_array_relationship',
      args: {
        name: 'books',
        source: TEST_DATA_SOURCE,
        table: {
          name: 'authors',
          schema: TEST_SCHEMA,
        },
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
    });
  });

  it('should prepare two object relationships for a one-to-one relation', async () => {
    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'book_metadata_id_fkey',
          columns: ['id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'book_metadata',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
          oneToOne: true,
        },
      ],
    });

    expect(response).toHaveLength(2);

    expect(response[0]).toEqual({
      type: 'pg_create_object_relationship',
      args: {
        name: 'book_metadatum',
        source: TEST_DATA_SOURCE,
        table: {
          name: 'books',
          schema: TEST_SCHEMA,
        },
        using: {
          foreign_key_constraint_on: 'id',
        },
      },
    });

    expect(response[1]).toEqual({
      type: 'pg_create_object_relationship',
      args: {
        name: 'book',
        source: TEST_DATA_SOURCE,
        table: {
          name: 'book_metadata',
          schema: TEST_SCHEMA,
        },
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
    });
  });

  it('should handle multiple foreign key relations', async () => {
    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'books_author_id_fkey',
          columns: ['author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
        {
          name: 'books_publisher_id_fkey',
          columns: ['publisher_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'publishers',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(4);
    expect(response[0].type).toBe('pg_create_object_relationship');
    expect(response[1].type).toBe('pg_create_array_relationship');
    expect(response[2].type).toBe('pg_create_object_relationship');
    expect(response[3].type).toBe('pg_create_array_relationship');
  });

  it('should return empty array when no foreign key relations are provided', async () => {
    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [],
    });

    expect(response).toEqual([]);
  });

  it('should handle tables in different schemas', async () => {
    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: 'public',
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'books_category_id_fkey',
          columns: ['category_id'],
          referencedSchema: 'catalog',
          referencedTable: 'categories',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(2);
    // biome-ignore lint/suspicious/noExplicitAny: test file
    expect((response[0].args.table as any).schema).toBe('public');
    // biome-ignore lint/suspicious/noExplicitAny: test file
    expect((response[1].args.table as any).schema).toBe('catalog');
  });

  it('should append column name to duplicate relationship names', async () => {
    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'books_author_id_fkey',
          columns: ['author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
        {
          name: 'books_co_author_id_fkey',
          columns: ['co_author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(4);

    expect(response[0].args.name).toBe('author_author_id');
    expect(response[1].args.name).toBe('books_author_id');
    expect(response[2].args.name).toBe('author_co_author_id');
    expect(response[3].args.name).toBe('books_co_author_id');
  });

  it('should handle multiple duplicate relationships on referenced table side', async () => {
    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'orders',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'orders_customer_id_fkey',
          columns: ['customer_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'users',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
        {
          name: 'orders_seller_id_fkey',
          columns: ['seller_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'users',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(4);

    expect(response[0].args.name).toBe('user_customer_id');
    expect(response[2].args.name).toBe('user_seller_id');

    expect(response[1].args.name).toBe('orders_customer_id');
    expect(response[3].args.name).toBe('orders_seller_id');
  });

  it('should handle three or more duplicate relationships', async () => {
    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'projects',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'projects_owner_id_fkey',
          columns: ['owner_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'users',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
        {
          name: 'projects_manager_id_fkey',
          columns: ['manager_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'users',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
        {
          name: 'projects_reviewer_id_fkey',
          columns: ['reviewer_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'users',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(6);

    expect(response[0].args.name).toBe('user_owner_id');
    expect(response[2].args.name).toBe('user_manager_id');
    expect(response[4].args.name).toBe('user_reviewer_id');

    expect(response[1].args.name).toBe('projects_owner_id');
    expect(response[3].args.name).toBe('projects_manager_id');
    expect(response[5].args.name).toBe('projects_reviewer_id');
  });

  it('should not modify names when there are no duplicates', async () => {
    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'books_author_id_fkey',
          columns: ['author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
        {
          name: 'books_publisher_id_fkey',
          columns: ['publisher_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'publishers',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(4);

    expect(response[0].args.name).toBe('author');
    expect(response[1].args.name).toBe('books');
    expect(response[2].args.name).toBe('publisher');
    expect(response[3].args.name).toBe('books');
  });

  it('should handle duplicates with one-to-one relationships', async () => {
    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'employees',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'employees_primary_address_id_fkey',
          columns: ['primary_address_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'addresses',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
          oneToOne: true,
        },
        {
          name: 'employees_secondary_address_id_fkey',
          columns: ['secondary_address_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'addresses',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
          oneToOne: true,
        },
      ],
    });

    expect(response).toHaveLength(4);

    expect(response[0].type).toBe('pg_create_object_relationship');
    expect(response[0].args.name).toBe('address_primary_address_id');

    expect(response[1].type).toBe('pg_create_object_relationship');
    expect(response[1].args.name).toBe('employee_primary_address_id');

    expect(response[2].type).toBe('pg_create_object_relationship');
    expect(response[2].args.name).toBe('address_secondary_address_id');

    expect(response[3].type).toBe('pg_create_object_relationship');
    expect(response[3].args.name).toBe('employee_secondary_address_id');
  });
  it('should append column name when relationship name conflicts with existing relationships on current table', async () => {
    vi.mocked(exportMetadataUtils.fetchExportMetadata).mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
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
                      foreign_key_constraint_on: 'existing_author_id',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'books_author_id_fkey',
          columns: ['author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_author_fkey',
          columns: ['existing_author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(2);
    expect(response[0].args.name).toBe('author_author_id');
    expect(response[1].args.name).toBe('books');

    expect(exportMetadataUtils.fetchExportMetadata).toHaveBeenCalledWith({
      adminSecret: TEST_ADMIN_SECRET,
      appUrl: TEST_APP_URL,
    });
  });

  it('should handle conflicts on referenced table side', async () => {
    vi.mocked(exportMetadataUtils.fetchExportMetadata).mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
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
                        column: 'existing_id',
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
          },
        ],
      },
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'books_author_id_fkey',
          columns: ['author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_fkey',
          columns: ['existing_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(2);
    expect(response[0].args.name).toBe('author');
    expect(response[1].args.name).toBe('books_author_id');
  });

  it('should handle multiple conflicts with existing relationships', async () => {
    vi.mocked(exportMetadataUtils.fetchExportMetadata).mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
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
                      foreign_key_constraint_on: 'existing_author_id',
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
                        column: 'existing_author_id',
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
          },
        ],
      },
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'books_author_id_fkey',
          columns: ['author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_fkey',
          columns: ['existing_author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(2);
    expect(response[0].args.name).toBe('author_author_id');
    expect(response[1].args.name).toBe('books_author_id');
  });

  it('avoids an unrelated existing remote relationship name during immediate tracking', async () => {
    vi.mocked(exportMetadataUtils.fetchExportMetadata).mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
            name: TEST_DATA_SOURCE,
            kind: 'postgres',
            tables: [
              {
                table: { name: 'authors', schema: TEST_SCHEMA },
                configuration: {},
                remote_relationships: [
                  {
                    name: 'books',
                    definition: {
                      to_source: {
                        source: 'analytics',
                        table: { name: 'legacy_books', schema: TEST_SCHEMA },
                        relationship_type: 'array',
                        field_mapping: { id: 'legacy_author_id' },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'books_author_id_fkey',
          columns: ['author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response[0].args.name).toBe('author');
    expect(response[1].args.name).toBe('books_author_id');
  });

  it('should handle combination of duplicate names and existing relationships', async () => {
    vi.mocked(exportMetadataUtils.fetchExportMetadata).mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
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
                        column: 'existing_id',
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
          },
        ],
      },
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'books_author_id_fkey',
          columns: ['author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
        {
          name: 'books_co_author_id_fkey',
          columns: ['co_author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_fkey',
          columns: ['existing_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(4);

    expect(response[0].args.name).toBe('author_author_id');
    expect(response[2].args.name).toBe('author_co_author_id');

    expect(response[1].args.name).toBe('books_author_id');
    expect(response[3].args.name).toBe('books_co_author_id');
  });

  it('should handle one-to-one relationships with existing conflicts', async () => {
    vi.mocked(exportMetadataUtils.fetchExportMetadata).mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
            name: TEST_DATA_SOURCE,
            kind: 'postgres',
            tables: [
              {
                table: {
                  name: 'employees',
                  schema: TEST_SCHEMA,
                },
                configuration: {},
                object_relationships: [
                  {
                    name: 'address',
                    using: {
                      foreign_key_constraint_on: 'existing_address_id',
                    },
                  },
                ],
              },
              {
                table: {
                  name: 'addresses',
                  schema: TEST_SCHEMA,
                },
                configuration: {},
                object_relationships: [
                  {
                    name: 'employee',
                    using: {
                      foreign_key_constraint_on: {
                        column: 'existing_address_id',
                        table: {
                          name: 'employees',
                          schema: TEST_SCHEMA,
                        },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'employees',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          columns: ['primary_address_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'addresses',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
          oneToOne: true,
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_address_fkey',
          columns: ['existing_address_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'addresses',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
          oneToOne: true,
        },
      ],
    });

    expect(response).toHaveLength(2);
    expect(response[0].type).toBe('pg_create_object_relationship');
    expect(response[0].args.name).toBe('address_primary_address_id');
    expect(response[1].type).toBe('pg_create_object_relationship');
    expect(response[1].args.name).toBe('employee_primary_address_id');
  });

  it('should handle empty metadata tables gracefully', async () => {
    vi.mocked(exportMetadataUtils.fetchExportMetadata).mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
            name: 'default',
            kind: 'postgres',
            tables: [],
          },
        ],
      },
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          columns: ['author_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_fkey',
          columns: ['existing_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(2);
    expect(response[0].args.name).toBe('author');
    expect(response[1].args.name).toBe('books');
  });

  it('should handle cross-schema relationships with existing conflicts', async () => {
    vi.mocked(exportMetadataUtils.fetchExportMetadata).mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
            name: TEST_DATA_SOURCE,
            kind: 'postgres',
            tables: [
              {
                table: {
                  name: 'books',
                  schema: 'public',
                },
                configuration: {},
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
                        column: 'existing_category_id',
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
          },
        ],
      },
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: 'public',
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          columns: ['category_id'],
          referencedSchema: 'catalog',
          referencedTable: 'categories',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_category_fkey',
          columns: ['existing_category_id'],
          referencedSchema: 'catalog',
          referencedTable: 'categories',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(2);
    expect(response[0].args.name).toBe('category');
    expect(response[1].args.name).toBe('books_category_id');
    // biome-ignore lint/suspicious/noExplicitAny: test file
    expect((response[0].args.table as any).schema).toBe('public');
    // biome-ignore lint/suspicious/noExplicitAny: test file
    expect((response[1].args.table as any).schema).toBe('catalog');
  });

  it('returns no operations for the whole batch when one relation is malformed', async () => {
    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'children',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'children_parent_fkey',
          columns: ['parent_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'parents',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
        {
          name: 'invalid_fkey',
          columns: ['tenant_id', 'parent_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'parents',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(0);
    expect(response).toEqual([]);
    expect(exportMetadataUtils.fetchExportMetadata).not.toHaveBeenCalled();
  });

  it.each([
    ['one-to-many', 'local', false],
    ['one-to-one', 'referenced', true],
  ] as const)('creates the missing self-referencing side for a %s relation with only the %s side tracked', async (_cardinality, existingSide, oneToOne) => {
    const reverseConstraint = {
      column: 'manager_id',
      table: { schema: TEST_SCHEMA, name: 'employees' },
    };
    const localRelationship = {
      name: 'manager',
      using: { foreign_key_constraint_on: 'manager_id' },
    };
    const referencedRelationship = {
      name: 'direct_reports',
      using: { foreign_key_constraint_on: reverseConstraint },
    };

    vi.mocked(exportMetadataUtils.fetchExportMetadata).mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
            name: TEST_DATA_SOURCE,
            kind: 'postgres',
            tables: [
              {
                table: { schema: TEST_SCHEMA, name: 'employees' },
                configuration: {},
                object_relationships:
                  existingSide === 'local'
                    ? [localRelationship]
                    : oneToOne
                      ? [referencedRelationship]
                      : [],
                array_relationships:
                  existingSide === 'referenced' && !oneToOne
                    ? [referencedRelationship]
                    : [],
              },
            ],
          },
        ],
      },
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'employees',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'employees_manager_id_fkey',
          columns: ['manager_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'employees',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
          oneToOne,
        },
      ],
    });

    expect(response).toEqual([
      {
        type:
          existingSide === 'local' && !oneToOne
            ? 'pg_create_array_relationship'
            : 'pg_create_object_relationship',
        args: {
          name:
            existingSide === 'local' && !oneToOne ? 'employees' : 'employee',
          source: TEST_DATA_SOURCE,
          table: { schema: TEST_SCHEMA, name: 'employees' },
          using: {
            foreign_key_constraint_on:
              existingSide === 'local' ? reverseConstraint : 'manager_id',
          },
        },
      },
    ]);
  });

  it('does not prepare duplicate operations for an already tracked composite pair', async () => {
    vi.mocked(exportMetadataUtils.fetchExportMetadata).mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
            name: TEST_DATA_SOURCE,
            kind: 'postgres',
            tables: [
              {
                table: { schema: TEST_SCHEMA, name: 'children' },
                configuration: {},
                object_relationships: [
                  {
                    name: 'parent',
                    using: {
                      foreign_key_constraint_on: ['tenant_id', 'parent_id'],
                    },
                  },
                ],
              },
              {
                table: { schema: TEST_SCHEMA, name: 'parents' },
                configuration: {},
                array_relationships: [
                  {
                    name: 'children',
                    using: {
                      foreign_key_constraint_on: {
                        columns: ['tenant_id', 'parent_id'],
                        table: { schema: TEST_SCHEMA, name: 'children' },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'children',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'children_parent_fkey',
          columns: ['tenant_id', 'parent_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'parents',
          referencedColumns: ['tenant_id', 'id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toEqual([]);
  });

  it('uses a numeric suffix when column-based collision names also collide', async () => {
    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'children',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'first_fkey',
          columns: ['tenant_id', 'parent_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'parents',
          referencedColumns: ['tenant_id', 'id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
        {
          name: 'second_fkey',
          columns: ['tenant_id', 'parent_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'parents',
          referencedColumns: ['tenant_id', 'alternate_id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response.map(({ args }) => args.name)).toEqual([
      'parent_tenant_id_parent_id',
      'children_tenant_id_parent_id',
      'parent_tenant_id_parent_id_2',
      'children_tenant_id_parent_id_2',
    ]);
  });

  it.each([
    ['one-to-many', 'one-to-one', false, true],
  ] as const)('keeps a %s relation tracked after its cardinality changes to %s', async (_trackedCardinality, _currentCardinality, trackedOneToOne, oneToOne) => {
    const reverseConstraint = {
      column: 'team_id',
      table: { schema: TEST_SCHEMA, name: 'memberships' },
    };
    const referencedRelationship = {
      name: trackedOneToOne ? 'membership' : 'memberships',
      using: { foreign_key_constraint_on: reverseConstraint },
    };

    vi.mocked(exportMetadataUtils.fetchExportMetadata).mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
            name: TEST_DATA_SOURCE,
            kind: 'postgres',
            tables: [
              {
                table: { schema: TEST_SCHEMA, name: 'memberships' },
                configuration: {},
                object_relationships: [
                  {
                    name: 'team',
                    using: { foreign_key_constraint_on: 'team_id' },
                  },
                ],
              },
              {
                table: { schema: TEST_SCHEMA, name: 'teams' },
                configuration: {},
                object_relationships: trackedOneToOne
                  ? [referencedRelationship]
                  : [],
                array_relationships: trackedOneToOne
                  ? []
                  : [referencedRelationship],
              },
            ],
          },
        ],
      },
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'memberships',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'memberships_team_id_fkey',
          columns: ['team_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'teams',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
          oneToOne,
        },
      ],
    });

    expect(response).toEqual([]);
  });

  it('distinguishes same-column foreign keys by the cardinality of their tracked relationships', async () => {
    vi.mocked(exportMetadataUtils.fetchExportMetadata).mockResolvedValue({
      resource_version: 1,
      metadata: {
        version: 3,
        sources: [
          {
            name: TEST_DATA_SOURCE,
            kind: 'postgres',
            tables: [
              {
                table: { schema: TEST_SCHEMA, name: 'teams' },
                configuration: {},
                object_relationships: [
                  {
                    name: 'membership',
                    using: {
                      foreign_key_constraint_on: {
                        column: 'team_id',
                        table: { schema: TEST_SCHEMA, name: 'memberships' },
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'memberships',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'memberships_team_id_fkey',
          columns: ['team_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'teams',
          referencedColumns: ['id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
          oneToOne: true,
        },
        {
          name: 'memberships_team_id_alternate_fkey',
          columns: ['team_id'],
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'teams',
          referencedColumns: ['alternate_id'],
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
          oneToOne: false,
        },
      ],
    });

    expect(
      response.map(
        ({ type, args }) => `${type} -> ${args.table.name}.${args.name}`,
      ),
    ).toEqual([
      'pg_create_object_relationship -> memberships.team_team_id',
      'pg_create_object_relationship -> memberships.team_team_id_2',
      'pg_create_array_relationship -> teams.memberships',
    ]);
  });
});
