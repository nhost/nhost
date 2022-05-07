import ApolloClient from "apollo-client";
import { NhostClient } from '@nhost/nhost-js';
import { InMemoryCache } from "apollo-cache-inmemory";
import { WebSocketLink } from "apollo-link-ws";
import { split } from "apollo-link";
import { HttpLink } from "apollo-link-http";
import { getMainDefinition } from "apollo-utilities";
require('dotenv').config()

const nhost = new NhostClient({
  backendUrl: process.env.backend_uri,
});

const accessToken = nhost.auth.getAccessToken()

const headers = {
  'content-type': 'application/json',
  'x-hasura-admin-secret': accessToken
};

const getHeaders = () => {
  return headers;
};

const cache = new InMemoryCache();

const wsLink = new WebSocketLink({
  uri: process.env.wslink_uri,
  options: {
    reconnect: true,
    lazy: true,
    connectionParams: () => {
      return { headers: getHeaders() };
    },
  },
});

const httpLink = new HttpLink({
  uri: process.env.backend_uri,
  headers: getHeaders()
});

const link = split(
  ({ query }) => {
    const { kind, operation } = getMainDefinition(query);
    return kind === "OperationDefinition" && operation === "subscription";
  },
  wsLink,
  httpLink
);

export const client = new ApolloClient({
  link,
  cache
});

