import { vi } from 'vitest';
import * as metadataQuery from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import prepareTrackForeignKeyRelationsMetadata from './prepareTrackForeignKeyRelationsMetadata';

// Mock the fetchMetadata module
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

describe('prepareTrackForeignKeyRelationsMetadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      tables: [],
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
          columnName: 'author_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
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
          columnName: 'id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'book_metadata',
          referencedColumn: 'id',
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
          columnName: 'category_id',
          referencedSchema: 'catalog',
          referencedTable: 'categories',
          referencedColumn: 'id',
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
          columnName: 'author_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
        {
          name: 'books_co_author_id_fkey',
          columnName: 'co_author_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
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
          columnName: 'owner_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'users',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
        {
          name: 'projects_manager_id_fkey',
          columnName: 'manager_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'users',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
        {
          name: 'projects_reviewer_id_fkey',
          columnName: 'reviewer_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'users',
          referencedColumn: 'id',
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
          columnName: 'primary_address_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'addresses',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
          oneToOne: true,
        },
        {
          name: 'employees_secondary_address_id_fkey',
          columnName: 'secondary_address_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'addresses',
          referencedColumn: 'id',
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
                foreign_key_constraint_on: 'existing_author_id',
              },
            },
          ],
        },
      ],
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
          columnName: 'author_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_author_fkey',
          columnName: 'existing_author_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(2);
    expect(response[0].args.name).toBe('author_author_id');
    expect(response[1].args.name).toBe('books');

    expect(metadataQuery.fetchMetadata).toHaveBeenCalledWith({
      dataSource: TEST_DATA_SOURCE,
      adminSecret: TEST_ADMIN_SECRET,
      appUrl: TEST_APP_URL,
    });
  });

  it('should handle conflicts on referenced table side', async () => {
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
          columnName: 'author_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_fkey',
          columnName: 'existing_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
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
          columnName: 'author_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_fkey',
          columnName: 'existing_author_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
    });

    expect(response).toHaveLength(2);
    expect(response[0].args.name).toBe('author_author_id');
    expect(response[1].args.name).toBe('books_author_id');
  });

  it('should not call fetchMetadata when trackedForeignKeyRelations is empty', async () => {
    await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'books_author_id_fkey',
          columnName: 'author_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: [],
    });

    expect(metadataQuery.fetchMetadata).not.toHaveBeenCalled();
  });

  it('should not call fetchMetadata when trackedForeignKeyRelations is undefined', async () => {
    await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          name: 'books_author_id_fkey',
          columnName: 'author_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: undefined,
    });

    expect(metadataQuery.fetchMetadata).not.toHaveBeenCalled();
  });

  it('should handle combination of duplicate names and existing relationships', async () => {
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
          columnName: 'author_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
        {
          name: 'books_co_author_id_fkey',
          columnName: 'co_author_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_fkey',
          columnName: 'existing_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
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
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
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
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'employees',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          columnName: 'primary_address_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'addresses',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
          oneToOne: true,
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_address_fkey',
          columnName: 'existing_address_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'addresses',
          referencedColumn: 'id',
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
    vi.mocked(metadataQuery.fetchMetadata).mockResolvedValue({
      resourceVersion: 1,
      tables: undefined,
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          columnName: 'author_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_fkey',
          columnName: 'existing_id',
          referencedSchema: TEST_SCHEMA,
          referencedTable: 'authors',
          referencedColumn: 'id',
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
    });

    const response = await prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: 'public',
      table: 'books',
      appUrl: TEST_APP_URL,
      adminSecret: TEST_ADMIN_SECRET,
      unTrackedForeignKeyRelations: [
        {
          columnName: 'category_id',
          referencedSchema: 'catalog',
          referencedTable: 'categories',
          referencedColumn: 'id',
          updateAction: 'RESTRICT',
          deleteAction: 'RESTRICT',
        },
      ],
      trackedForeignKeyRelations: [
        {
          name: 'existing_category_fkey',
          columnName: 'existing_category_id',
          referencedSchema: 'catalog',
          referencedTable: 'categories',
          referencedColumn: 'id',
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
});
