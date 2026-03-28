import type { GraphQLNamedType, GraphQLType } from 'graphql';

/**
 * Unwrap a GraphQL type to its base named type by removing all wrapper types
 * (NonNull, List, etc.). This is useful for getting the underlying type name
 * from complex types like `[User!]!`.
 */
export default function unwrapNamedType(type: GraphQLType): GraphQLNamedType {
  let current: GraphQLType = type;
  while (
    current &&
    typeof current === 'object' &&
    'ofType' in current &&
    current.ofType
  ) {
    current = current.ofType as GraphQLType;
  }
  return current as GraphQLNamedType;
}
