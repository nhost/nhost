import {
  buildClientSchema,
  type GraphQLSchema,
  type IntrospectionQuery,
} from 'graphql';

export default function convertIntrospectionToSchema(
  introspectionData: IntrospectionQuery,
): GraphQLSchema | null {
  return buildClientSchema(introspectionData);
}
