import type { GraphQLSchema } from 'graphql';

export default function getSchemaRoots(schema: GraphQLSchema) {
  const res = [schema.getQueryType()?.name];
  if (schema.getMutationType()?.name) {
    res.push(schema.getMutationType()?.name);
  }
  if (schema.getSubscriptionType()?.name) {
    res.push(schema.getSubscriptionType()?.name);
  }
  return res;
}
