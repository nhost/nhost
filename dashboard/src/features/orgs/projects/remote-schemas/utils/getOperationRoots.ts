import type { GraphQLObjectType, GraphQLSchema } from 'graphql';

export type OperationRoot = {
  /** Semantic display label: "Query", "Mutation", or "Subscription" */
  label: string;
  /** Operation type identifier */
  value: 'query' | 'mutation' | 'subscription';
  /** The actual GraphQL type name from the schema (e.g., "query_root", "Root") */
  typeName: string;
  /** The full GraphQL object type */
  type: GraphQLObjectType;
};

/**
 * Get the operation roots (Query, Mutation, Subscription) from a GraphQL schema.
 * Returns an array of objects with:
 * - `label`: Semantic display name ("Query", "Mutation", "Subscription")
 * - `value`: Operation type identifier
 * - `typeName`: The actual type name from the schema (may differ, e.g., "query_root")
 * - `type`: The full GraphQL object type for accessing fields
 */
export default function getOperationRoots(
  graphqlSchema: GraphQLSchema,
): OperationRoot[] {
  const roots: OperationRoot[] = [];

  const queryType = graphqlSchema.getQueryType();
  if (queryType) {
    roots.push({
      label: 'Query',
      value: 'query',
      typeName: queryType.name,
      type: queryType,
    });
  }

  const mutationType = graphqlSchema.getMutationType();
  if (mutationType) {
    roots.push({
      label: 'Mutation',
      value: 'mutation',
      typeName: mutationType.name,
      type: mutationType,
    });
  }

  const subscriptionType = graphqlSchema.getSubscriptionType();
  if (subscriptionType) {
    roots.push({
      label: 'Subscription',
      value: 'subscription',
      typeName: subscriptionType.name,
      type: subscriptionType,
    });
  }

  return roots;
}
