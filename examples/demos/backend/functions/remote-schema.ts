import type { Request, Response } from "express";
import { createSchema, createYoga } from "graphql-yoga";

const typeDefs = `
  type Query {
    hello: String!
  }
`;

const resolvers = {
  Query: {
    hello: () => "world",
  },
};

const schema = createSchema({ typeDefs, resolvers });

const yoga = createYoga({
  schema,
  graphqlEndpoint: "*",
});

export default async function handler(req: Request, res: Response) {
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  const response = await yoga.fetch(url, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
  });

  res.status(response.status);
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  const body = await response.text();
  res.send(body);
}
