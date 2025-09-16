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

export const hasuraColumnMetadataQuery = rest.post(
  'https://local.hasura.local.nhost.run/v1/metadata',
  (_req, res, ctx) =>
    res(
      ctx.json({
        resource_version: 389,
        metadata: {
          version: 3,
          sources: [
            {
              name: 'default',
              kind: 'postgres',
              tables: [
                {
                  table: {
                    name: 'actor',
                    schema: 'public',
                  },
                  object_relationships: [
                    {
                      name: 'actor_movie',
                      using: {
                        foreign_key_constraint_on: {
                          column: 'actor_id',
                          table: {
                            name: 'actor_movie',
                            schema: 'public',
                          },
                        },
                      },
                    },
                  ],
                },
                {
                  table: {
                    name: 'actor_movie',
                    schema: 'public',
                  },
                  object_relationships: [
                    {
                      name: 'actor',
                      using: {
                        foreign_key_constraint_on: 'actor_id',
                      },
                    },
                    {
                      name: 'movie',
                      using: {
                        foreign_key_constraint_on: 'movie_id',
                      },
                    },
                  ],
                },
                {
                  table: {
                    name: 'director',
                    schema: 'public',
                  },
                  array_relationships: [
                    {
                      name: 'movies',
                      using: {
                        foreign_key_constraint_on: {
                          column: 'director_id',
                          table: {
                            name: 'movies',
                            schema: 'public',
                          },
                        },
                      },
                    },
                  ],
                },
                {
                  table: {
                    name: 'movies',
                    schema: 'public',
                  },
                  object_relationships: [
                    {
                      name: 'author',
                      using: {
                        foreign_key_constraint_on: 'director_id',
                      },
                    },
                  ],
                  array_relationships: [
                    {
                      name: 'actor_movie',
                      using: {
                        foreign_key_constraint_on: {
                          column: 'movie_id',
                          table: {
                            name: 'actor_movie',
                            schema: 'public',
                          },
                        },
                      },
                    },
                  ],
                },
                {
                  table: {
                    name: 'notes',
                    schema: 'public',
                  },
                  object_relationships: [
                    {
                      name: 'user',
                      using: {
                        foreign_key_constraint_on: 'owner',
                      },
                    },
                  ],
                  insert_permissions: [
                    {
                      role: 'user',
                      permission: {
                        check: {
                          owner: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                        columns: ['id', 'note', 'owner'],
                      },
                    },
                  ],
                  select_permissions: [
                    {
                      role: 'user',
                      permission: {
                        columns: ['id', 'note'],
                        filter: {
                          owner: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                    },
                  ],
                  update_permissions: [
                    {
                      role: 'user',
                      permission: {
                        columns: ['note'],
                        filter: {
                          owner: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                        check: null,
                      },
                    },
                  ],
                  delete_permissions: [
                    {
                      role: 'user',
                      permission: {
                        filter: {
                          id: {
                            _eq: 'X-Hasura-User-Id',
                          },
                        },
                      },
                    },
                  ],
                },
                {
                  table: {
                    name: 'buckets',
                    schema: 'storage',
                  },
                  configuration: {
                    column_config: {
                      cache_control: {
                        custom_name: 'cacheControl',
                      },
                      created_at: {
                        custom_name: 'createdAt',
                      },
                      download_expiration: {
                        custom_name: 'downloadExpiration',
                      },
                      id: {
                        custom_name: 'id',
                      },
                      max_upload_file_size: {
                        custom_name: 'maxUploadFileSize',
                      },
                      min_upload_file_size: {
                        custom_name: 'minUploadFileSize',
                      },
                      presigned_urls_enabled: {
                        custom_name: 'presignedUrlsEnabled',
                      },
                      updated_at: {
                        custom_name: 'updatedAt',
                      },
                    },
                    custom_column_names: {
                      cache_control: 'cacheControl',
                      created_at: 'createdAt',
                      download_expiration: 'downloadExpiration',
                      id: 'id',
                      max_upload_file_size: 'maxUploadFileSize',
                      min_upload_file_size: 'minUploadFileSize',
                      presigned_urls_enabled: 'presignedUrlsEnabled',
                      updated_at: 'updatedAt',
                    },
                    custom_name: 'buckets',
                    custom_root_fields: {
                      delete: 'deleteBuckets',
                      delete_by_pk: 'deleteBucket',
                      insert: 'insertBuckets',
                      insert_one: 'insertBucket',
                      select: 'buckets',
                      select_aggregate: 'bucketsAggregate',
                      select_by_pk: 'bucket',
                      update: 'updateBuckets',
                      update_by_pk: 'updateBucket',
                    },
                  },
                  array_relationships: [
                    {
                      name: 'files',
                      using: {
                        foreign_key_constraint_on: {
                          column: 'bucket_id',
                          table: {
                            name: 'files',
                            schema: 'storage',
                          },
                        },
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
