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

// Plugin to handle pre-parsed body from Express middleware
const useExpressParsedBody: Plugin = {
  onRequestParse({ serverContext, setRequestParser }) {
    const expressReq = (serverContext as any)?.req;
    if (expressReq?.body) {
      setRequestParser(async () => ({
        query: expressReq.body.query,
        variables: expressReq.body.variables,
        operationName: expressReq.body.operationName,
        extensions: expressReq.body.extensions,
      }));
    }
  },
};

const yoga = createYoga({
  schema,
  graphqlEndpoint: '*',
  plugins: [useExpressParsedBody],
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
