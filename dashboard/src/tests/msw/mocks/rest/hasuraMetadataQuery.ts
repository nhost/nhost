import { rest } from 'msw';

const hasuraMetadataQuery = rest.post(
  'https://local.hasura.local.nhost.run/v1/metadata',
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

export const hasuraRelationShipsMetadataQuery = rest.post(
  'https://local.hasura.local.nhost.run/v1/metadata',
  (_req, res, ctx) =>
    res(
      ctx.json({
        resource_version: 26,
        metadata: {
          version: 3,
          sources: [
            {
              name: 'default',
              kind: 'postgres',
              tables: [
                {
                  table: {
                    name: 'country',
                    schema: 'public',
                  },
                  array_relationships: [
                    {
                      name: 'county',
                      using: {
                        foreign_key_constraint_on: {
                          column: 'countryId',
                          table: {
                            name: 'county',
                            schema: 'public',
                          },
                        },
                      },
                    },
                  ],
                },
                {
                  table: {
                    name: 'county',
                    schema: 'public',
                  },
                  object_relationships: [
                    {
                      name: 'country',
                      using: {
                        foreign_key_constraint_on: 'countryId',
                      },
                    },
                  ],
                  array_relationships: [
                    {
                      name: 'town',
                      using: {
                        foreign_key_constraint_on: {
                          column: 'countyId',
                          table: {
                            name: 'town',
                            schema: 'public',
                          },
                        },
                      },
                    },
                  ],
                },
                {
                  table: {
                    name: 'town',
                    schema: 'public',
                  },
                  object_relationships: [
                    {
                      name: 'county',
                      using: {
                        foreign_key_constraint_on: 'countyId',
                      },
                    },
                  ],
                },
              ],
              configuration: {
                connection_info: {
                  database_url: {
                    from_env: 'HASURA_GRAPHQL_DATABASE_URL',
                  },
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
      }),
    ),
);

export default hasuraMetadataQuery;
