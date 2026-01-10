import { createSchema, createYoga } from 'graphql-yoga';
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

const yoga = createYoga({ schema });

export default async function handler(req: Request, res: Response) {
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }

  const request = new Request(url, {
    method: req.method,
    headers,
    body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
  });

  const response = await yoga.fetch(request);

  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const text = await response.text();
  res.send(text);
}
