import type { GraphQLFieldMap, GraphQLSchema } from 'graphql';
import type { ArgTreeType, FieldType } from '../types';

/**
 * Sets query_root and mutation_root in UI tree.
 * @param introspectionSchema Remote Schema introspection schema.
 * @param permissionsSchema Permissions coming from saved role.
 * @param typeS Type of args.
 * @returns Array of schema fields (query_root and mutation_root)
 */
export const getTree = (
  introspectionSchema: GraphQLSchema | null,
  permissionsSchema: GraphQLSchema | null,
  typeS: string,
) => {
  const introspectionSchemaFields =
    typeS === 'QUERY'
      ? introspectionSchema!.getQueryType()?.getFields()
      : introspectionSchema!.getMutationType()?.getFields();

  let permissionsSchemaFields:
    | GraphQLFieldMap<any, any, Record<string, any>>
    | null
    | undefined = null;
  if (permissionsSchema !== null) {
    permissionsSchemaFields =
      typeS === 'QUERY'
        ? permissionsSchema!.getQueryType()?.getFields()
        : permissionsSchema!.getMutationType()?.getFields();
  }

  if (introspectionSchemaFields) {
    return Object.values(introspectionSchemaFields).map(
      ({ name, args: argArray, type, ...rest }: any) => {
        let checked = false;
        const parentName =
          typeS === 'QUERY'
            ? `type ${introspectionSchema?.getQueryType()?.name}`
            : `type ${introspectionSchema?.getMutationType()?.name}`;
        const args = argArray.reduce(
          (p: ArgTreeType, c: FieldType) => ({ ...p, [c.name]: { ...c } }),
          {},
        );
        if (
          permissionsSchema !== null &&
          permissionsSchemaFields &&
          name in permissionsSchemaFields
        ) {
          checked = true;
        }
        return {
          name,
          checked,
          args,
          return: type.toString(),
          parentName,
          ...rest,
        };
      },
    );
  }
  return [];
};
