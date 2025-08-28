import type { RemoteSchemaFields } from '@/features/orgs/projects/remote-schemas/types';
import type { GraphQLSchema } from 'graphql';
import { getTree } from './getTree';
import { getType } from './getType';

export const getRemoteSchemaFields = (
  schema: GraphQLSchema,
  permissionsSchema: GraphQLSchema | null,
): RemoteSchemaFields[] => {
  const types = getType(schema, permissionsSchema);

  const queryRoot = schema?.getQueryType()?.name;
  const mutationRoot = schema?.getMutationType()?.name;

  const remoteFields = [
    {
      name: `type ${queryRoot}`,
      typeName: '__query_root',
      children: getTree(schema, permissionsSchema, 'QUERY'),
    },
  ];
  if (mutationRoot) {
    remoteFields.push({
      name: `type ${mutationRoot}`,
      typeName: '__mutation_root',
      children: getTree(schema, permissionsSchema, 'MUTATION'),
    });
  }
  return [...remoteFields, ...types];
};
