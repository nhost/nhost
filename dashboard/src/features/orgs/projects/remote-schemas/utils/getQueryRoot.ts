import type { GraphQLObjectType, GraphQLSchema } from 'graphql';

export type QueryRoot = {
  /** The actual GraphQL type name from the schema (e.g., "query_root", "Root") */
  typeName: string;
  /** The full GraphQL object type */
  type: GraphQLObjectType;
};

/**
 * Get the Query operation root from a GraphQL schema.
 * Returns the Query type if available, or null if the schema doesn't have a Query type.
 */
export default function getQueryRoot(
  graphqlSchema: GraphQLSchema,
): QueryRoot | null {
  const queryType = graphqlSchema.getQueryType();
  if (!queryType) {
    return null;
  }

  return {
    typeName: queryType.name,
    type: queryType,
  };
}
