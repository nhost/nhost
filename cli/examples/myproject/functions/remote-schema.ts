import { createSchema, createYoga, type Plugin } from 'graphql-yoga';

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

export default yoga;
