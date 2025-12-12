import prepareTrackForeignKeyRelationsMetadata from './prepareTrackForeignKeyRelationsMetadata';

const TEST_DATA_SOURCE = 'default';
const TEST_SCHEMA = 'public';

describe('prepareTrackForeignKeyRelationsMetadata', () => {
  it('should prepare both object and array relationships for a one-to-many relation', () => {
    const response = prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      foreignKeyRelations: [
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

  it('should prepare two object relationships for a one-to-one relation', () => {
    const response = prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      foreignKeyRelations: [
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

  it('should handle multiple foreign key relations', () => {
    const response = prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      foreignKeyRelations: [
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

  it('should return empty array when no foreign key relations are provided', () => {
    const response = prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      foreignKeyRelations: [],
    });

    expect(response).toEqual([]);
  });

  it('should handle tables in different schemas', () => {
    const response = prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: 'public',
      table: 'books',
      foreignKeyRelations: [
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
    expect((response[0].args.table as any).schema).toBe('public');
    expect((response[1].args.table as any).schema).toBe('catalog');
  });

  it('should append column name to duplicate relationship names', () => {
    const response = prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      foreignKeyRelations: [
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

  it('should handle multiple duplicate relationships on referenced table side', () => {
    const response = prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'orders',
      foreignKeyRelations: [
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

  it('should handle three or more duplicate relationships', () => {
    const response = prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'projects',
      foreignKeyRelations: [
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

  it('should not modify names when there are no duplicates', () => {
    const response = prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'books',
      foreignKeyRelations: [
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

  it('should handle duplicates with one-to-one relationships', () => {
    const response = prepareTrackForeignKeyRelationsMetadata({
      dataSource: TEST_DATA_SOURCE,
      schema: TEST_SCHEMA,
      table: 'employees',
      foreignKeyRelations: [
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
});
