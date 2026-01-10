import { createSchema, createYoga, type Plugin } from 'graphql-yoga';
import type { Request, Response } from 'express';

const typeDefs = `
  type Query {
    hello: String!
  }
`;

const resolvers = {
  Query: {
    hello: () => 'world',
  },
};

const schema = createSchema({ typeDefs, resolvers });

const yoga = createYoga({
  schema,
  graphqlEndpoint: '*',
});

export default async function handler(req: Request, res: Response) {
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  const response = await yoga.fetch(
    url,
    {
      method: req.method,
      headers: req.headers as HeadersInit,
    },
    { req } // serverContext - makes req.body available to the plugin
  );

  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const body = await response.text();
  res.send(body);
}
