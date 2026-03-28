import { type GraphQLType, isListType, isNonNullType } from 'graphql';

/**
 * Get the string representation of a GraphQL type, including modifiers.
 * For example: `User!`, `[Post!]!`, `String`.
 */
export default function getTypeString(type: GraphQLType): string {
  if (isNonNullType(type)) {
    return `${getTypeString(type.ofType)}!`;
  }
  if (isListType(type)) {
    return `[${getTypeString(type.ofType)}]`;
  }
  return type.name;
}
