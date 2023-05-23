import type { HasuraMetadata } from '@/features/database/dataGrid/types/dataBrowser';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import prepareTrackForeignKeyRelationsMetadata from './prepareTrackForeignKeyRelationsMetadata';

const APP_URL = 'http://localhost';
const testMetadataResponse: { metadata: HasuraMetadata } = {
  metadata: {
    version: 3,
    sources: [
      {
        name: 'default',
        kind: 'postgres',
        tables: [
          {
            table: {
              name: 'books',
              schema: 'public',
            },
            configuration: {},
            array_relationships: [],
            object_relationships: [],
          },
        ],
      },
    ],
  },
};

const metadataHandlers = [
  rest.post(`${APP_URL}/v1/metadata`, (_req, res, ctx) =>
    res(
      ctx.status(200),
      ctx.json<{ metadata: HasuraMetadata }>(testMetadataResponse),
    ),
  ),
];

const server = setupServer(...metadataHandlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('should only prepare a one-to-many relationship if the table does not have any relationships', async () => {
  const response = await prepareTrackForeignKeyRelationsMetadata({
    dataSource: 'default',
    appUrl: APP_URL,
    adminSecret: '',
    schema: 'public',
    table: 'books',
    foreignKeyRelations: [
      {
        name: 'authors_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: 'public',
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ],
  });

  expect(response).toHaveLength(2);
  expect(response[0].type).toBe('pg_create_object_relationship');
  expect(response[1].type).toBe('pg_create_array_relationship');
});

test('should only prepare a one-to-one relationship if the table does not have any relationships', async () => {
  const response = await prepareTrackForeignKeyRelationsMetadata({
    dataSource: 'default',
    appUrl: APP_URL,
    adminSecret: '',
    schema: 'public',
    table: 'books',
    foreignKeyRelations: [
      {
        name: 'book_metadata_id_fkey',
        columnName: 'id',
        referencedSchema: 'public',
        referencedTable: 'book_metadata',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
        oneToOne: true,
      },
    ],
  });

  expect(response).toHaveLength(2);
  expect(response[0]).toMatchInlineSnapshot(`
    {
      "args": {
        "name": "book_metadatum",
        "source": "default",
        "table": {
          "name": "books",
          "schema": "public",
        },
        "using": {
          "foreign_key_constraint_on": "id",
        },
      },
      "type": "pg_create_object_relationship",
    }
  `);
  expect(response[1]).toMatchInlineSnapshot(`
    {
      "args": {
        "name": "book",
        "source": "default",
        "table": {
          "name": "book_metadata",
          "schema": "public",
        },
        "using": {
          "foreign_key_constraint_on": {
            "column": "id",
            "table": {
              "name": "books",
              "schema": "public",
            },
          },
        },
      },
      "type": "pg_create_object_relationship",
    }
  `);
});

test('should drop existing relationships and prepare a new one-to-many relationship', async () => {
  server.use(
    rest.post(`${APP_URL}/v1/metadata`, (_req, res, ctx) =>
      res(
        ctx.status(200),
        ctx.json<{ metadata: HasuraMetadata }>({
          ...testMetadataResponse,
          metadata: {
            ...testMetadataResponse.metadata,
            sources: [
              {
                ...testMetadataResponse.metadata.sources[0],
                tables: [
                  {
                    ...testMetadataResponse.metadata.sources[0].tables[0],
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
                      schema: 'public',
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
                              schema: 'public',
                            },
                          },
                        },
                      },
                    ],
                    object_relationships: [],
                  },
                ],
              },
            ],
          },
        }),
      ),
    ),
  );

  const response = await prepareTrackForeignKeyRelationsMetadata({
    dataSource: 'default',
    appUrl: APP_URL,
    adminSecret: '',
    schema: 'public',
    table: 'books',
    foreignKeyRelations: [
      {
        name: 'authors_author_id_fkey',
        columnName: 'author_id',
        referencedSchema: 'public',
        referencedTable: 'authors',
        referencedColumn: 'id',
        updateAction: 'RESTRICT',
        deleteAction: 'RESTRICT',
      },
    ],
  });

  expect(response).toHaveLength(4);
  expect(response[0]).toMatchInlineSnapshot(`
    {
      "args": {
        "cascade": false,
        "relationship": "author",
        "source": "default",
        "table": "books",
      },
      "type": "pg_drop_relationship",
    }
  `);
  expect(response[1]).toMatchInlineSnapshot(`
    {
      "args": {
        "name": "author",
        "source": "default",
        "table": {
          "name": "books",
          "schema": "public",
        },
        "using": {
          "foreign_key_constraint_on": "author_id",
        },
      },
      "type": "pg_create_object_relationship",
    }
  `);
  expect(response[2]).toMatchInlineSnapshot(`
    {
      "args": {
        "cascade": false,
        "relationship": "books",
        "source": "default",
        "table": {
          "name": "authors",
          "schema": "public",
        },
      },
      "type": "pg_drop_relationship",
    }
  `);
  expect(response[3]).toMatchInlineSnapshot(`
    {
      "args": {
        "name": "books",
        "source": "default",
        "table": {
          "name": "authors",
          "schema": "public",
        },
        "using": {
          "foreign_key_constraint_on": {
            "column": "author_id",
            "table": {
              "name": "books",
              "schema": "public",
            },
          },
        },
      },
      "type": "pg_create_array_relationship",
    }
  `);
});
