import { rest } from 'msw';

const hasuraMetadataQuery = rest.post(
  'https://local.hasura.nhost.run/v1/metadata',
  (_req, res, ctx) =>
    res(
      ctx.delay(250),
      ctx.json({
        metadata: {
          version: 3,
          sources: [
            {
              name: 'default',
              kind: 'postgres',
              tables: [
                {
                  table: { name: 'authors', schema: 'public' },
                  array_relationships: [
                    {
                      name: 'books',
                      using: {
                        foreign_key_constraint_on: {
                          column: 'author_id',
                          table: { name: 'books', schema: 'public' },
                        },
                      },
                    },
                  ],
                },
                {
                  table: { name: 'books', schema: 'public' },
                  object_relationships: [
                    {
                      name: 'author',
                      using: { foreign_key_constraint_on: 'author_id' },
                    },
                  ],
                },
              ],
              configuration: {
                connection_info: {
                  database_url: { from_env: 'HASURA_GRAPHQL_DATABASE_URL' },
                  isolation_level: 'read-committed',
                  pool_settings: {
                    connection_lifetime: 600,
                    idle_timeout: 180,
                    max_connections: 50,
                    retries: 1,
                  },
                  use_prepared_statements: true,
                },
              },
            },
          ],
        },
        resource_version: 10,
      }),
    ),
);

export default hasuraMetadataQuery;
