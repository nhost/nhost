import type { IntrospectRemoteSchemaResponse } from '@/utils/hasura-api/generated/schemas';
import { buildClientSchema, type GraphQLSchema } from 'graphql';

export default function convertIntrospectionToSchema(
  introspectionData: IntrospectRemoteSchemaResponse,
): GraphQLSchema {
  return buildClientSchema(introspectionData.data as any);
}
