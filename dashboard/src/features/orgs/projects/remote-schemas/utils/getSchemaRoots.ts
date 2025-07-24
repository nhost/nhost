import type { GraphQLSchema } from 'graphql';

export default function getSchemaRoots(schema: GraphQLSchema) {
  if (!schema) {
    return [];
  }
  const res = [schema.getQueryType()?.name]; // query root always present
  if (schema.getMutationType()?.name) {
    res.push(schema.getMutationType()?.name);
  }
  if (schema.getSubscriptionType()?.name) {
    res.push(schema.getSubscriptionType()?.name);
  }
  return res;
}
