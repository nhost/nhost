import { createSchema, createYoga } from 'graphql-yoga';

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

export default yoga;
