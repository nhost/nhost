import { GraphQLClient } from 'graphql-request';
import { getSdk } from './__generated__/graphql-request';
import { ENV } from './env';

export const client = new GraphQLClient(ENV.HASURA_GRAPHQL_GRAPHQL_URL, {
  headers: {
    'x-hasura-admin-secret': ENV.HASURA_GRAPHQL_ADMIN_SECRET,
  },
});
export const gqlSdk = getSdk(client);
