import { GraphQLClient } from "graphql-request";
import { getSdk } from "./__generated__/graphql-request";
import { APPLICATION } from "@config/index";

export const client = new GraphQLClient(APPLICATION.HASURA_ENDPOINT, {
  headers: {
    "x-hasura-admin-secret": APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET,
  },
});
export const gqlSdk = getSdk(client);
