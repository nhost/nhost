import type { IntrospectRemoteSchemaResponse } from '@/utils/hasura-api/generated/schemas';
import { buildClientSchema, type GraphQLSchema } from 'graphql';

export default function convertIntrospectionToSchema(
  introspectionData: IntrospectRemoteSchemaResponse,
): GraphQLSchema | null {
  return introspectionData?.data
    ? buildClientSchema(introspectionData.data as any)
    : null;
}
