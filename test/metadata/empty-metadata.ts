import { HasuraMetadataV3 } from '@/utils';

export const EMPTY_METADATA: HasuraMetadataV3 = {
  version: 3,
  sources: [
    {
      name: 'default',
      kind: 'postgres',
      tables: [],
      configuration: {
        connection_info: {
          use_prepared_statements: true,
          database_url: {
            from_env: 'HASURA_GRAPHQL_DATABASE_URL',
          },
          isolation_level: 'read-committed',
          pool_settings: {
            connection_lifetime: 600,
            retries: 1,
            idle_timeout: 180,
            max_connections: 50,
          },
        },
      },
    },
  ],
};
