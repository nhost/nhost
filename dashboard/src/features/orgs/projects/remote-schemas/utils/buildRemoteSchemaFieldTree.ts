import {
  type GraphQLArgument,
  GraphQLEnumType,
  type GraphQLFieldMap,
  type GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  type GraphQLSchema,
  GraphQLUnionType,
} from 'graphql';
import type {
  CustomFieldType,
  RemoteSchemaFields,
} from '@/features/orgs/projects/remote-schemas/types';
import getSchemaRoots from './getSchemaRoots';

function getTree(
  introspectionSchema: GraphQLSchema,
  permissionsSchema: GraphQLSchema | null,
  typeS: 'QUERY' | 'MUTATION',
) {
  const baseType =
    typeS === 'QUERY'
      ? introspectionSchema?.getQueryType()
      : introspectionSchema?.getMutationType();
  const baseFields = baseType?.getFields?.();
  if (!baseFields) {
    return [];
  }

  const permType =
    permissionsSchema &&
    (typeS === 'QUERY'
      ? permissionsSchema.getQueryType()
      : permissionsSchema.getMutationType());
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  const permFields: GraphQLFieldMap<any, any> | null = permType
    ? (permType.getFields?.() ?? null)
    : null;

  const parentName = `type ${baseType?.name}`;

  return Object.values(baseFields).map((field) => {
    const { name, args: argArray, type, ...rest } = field;
    const args = (argArray ?? []).reduce<Record<string, GraphQLArgument>>(
      (acc, arg) => {
        // biome-ignore lint/style/noParameterAssign: Disabled to avoid spread operator performance overhead in reduce.
        acc[arg.name] = arg;
        return acc;
      },
      {},
    );
    const checked = Boolean(permFields && name in permFields);

    return {
      name,
      checked,
      args,
      return: type?.toString?.() ?? String(type),
      parentName,
      ...rest,
    } satisfies CustomFieldType;
  });
}

function getType(
  introspectionSchema: GraphQLSchema,
  permissionsSchema: GraphQLSchema | null,
) {
  const introspectionSchemaFields = introspectionSchema.getTypeMap();
  const permissionsSchemaFields = permissionsSchema
    ? permissionsSchema.getTypeMap()
    : null;

  const enumTypes: RemoteSchemaFields[] = [];
  const scalarTypes: RemoteSchemaFields[] = [];
  const inputObjectTypes: RemoteSchemaFields[] = [];
  const objectTypes: RemoteSchemaFields[] = [];
  const unionTypes: RemoteSchemaFields[] = [];
  const interfaceTypes: RemoteSchemaFields[] = [];

  const roots = getSchemaRoots(introspectionSchema);

  const isPermittedType = (typeKey: string) =>
    Boolean(
      permissionsSchema &&
        permissionsSchemaFields &&
        typeKey in permissionsSchemaFields,
    );

  Object.entries(introspectionSchemaFields).forEach(([key, value]) => {
    if (
      !(
        value instanceof GraphQLObjectType ||
        value instanceof GraphQLInputObjectType ||
        value instanceof GraphQLEnumType ||
        value instanceof GraphQLScalarType ||
        value instanceof GraphQLUnionType ||
        value instanceof GraphQLInterfaceType
      )
    ) {
      return;
    }

    const typeName = value.name as string;
    if (roots.includes(typeName)) {
      return;
    }
    if (typeName.startsWith('__')) {
      return;
    }

    const type: RemoteSchemaFields = { name: ``, typeName, children: [] };

    if (value instanceof GraphQLEnumType) {
      type.name = `enum ${typeName}`;
      const checked = isPermittedType(key);
      type.children = value.getValues().map((v) => ({ name: v.name, checked }));
      enumTypes.push(type);
      return;
    }

    if (value instanceof GraphQLScalarType) {
      type.name = `scalar ${typeName}`;
      const checked = isPermittedType(key);
      type.children = [{ name: type.name, checked }];
      scalarTypes.push(type);
      return;
    }

    if (value instanceof GraphQLObjectType) {
      type.name = `type ${typeName}`;
      if (value.getInterfaces().length) {
        const implementsString = value
          .getInterfaces()
          .map((i) => i.name)
          .join('& ');
        type.name = `type ${typeName} implements ${implementsString}`;
      }
    } else if (value instanceof GraphQLInputObjectType) {
      type.name = `input ${typeName}`;
    }

    if (
      value instanceof GraphQLObjectType ||
      value instanceof GraphQLInputObjectType
    ) {
      const fieldVal = value.getFields();
      const permissionsFieldNames: Record<string, true> = {};
      let isFieldPresent = true;

      if (permissionsSchema && permissionsSchemaFields) {
        if (key in permissionsSchemaFields) {
          const permNamedType = permissionsSchemaFields[key];
          if (
            permNamedType instanceof GraphQLObjectType ||
            permNamedType instanceof GraphQLInputObjectType ||
            permNamedType instanceof GraphQLInterfaceType
          ) {
            const permFields = permNamedType.getFields();
            Object.keys(permFields).forEach((fname) => {
              permissionsFieldNames[fname] = true;
            });
          } else {
            isFieldPresent = false;
          }
        } else {
          isFieldPresent = false;
        }
      }

      const childArray: CustomFieldType[] = [];
      Object.entries(fieldVal).forEach(([k, v]) => {
        const checked = Boolean(
          permissionsSchema && isFieldPresent && k in permissionsFieldNames,
        );
        const field: CustomFieldType = {
          name: v.name,
          checked,
          return: v.type.toString(),
        };
        if ((v as GraphQLInputField).defaultValue !== undefined) {
          field.defaultValue = v.defaultValue;
        }

        if (value instanceof GraphQLInputObjectType) {
          field.isInputObjectType = true;
          field.parentName = type.name;
        } else if (v.args?.length) {
          const argsMap = (v.args as ReadonlyArray<GraphQLArgument>).reduce(
            (acc, arg) => {
              // biome-ignore lint/style/noParameterAssign: Disabled to avoid spread operator performance overhead in reduce.
              acc[arg.name] = arg;
              return acc;
            },
            {} as Record<string, GraphQLArgument>,
          );
          field.args = argsMap;
        }
        childArray.push(field);
      });
      type.children = childArray;
      if (value instanceof GraphQLObjectType) {
        objectTypes.push(type);
      }
      if (value instanceof GraphQLInputObjectType) {
        inputObjectTypes.push(type);
      }
      return;
    }

    if (value instanceof GraphQLUnionType) {
      let isFieldPresent = true;
      // biome-ignore lint/suspicious/noExplicitAny: TODO
      let permissionsTypesVal: ReadonlyArray<GraphQLObjectType<any, any>> = [];
      if (permissionsSchema && permissionsSchemaFields) {
        if (key in permissionsSchemaFields) {
          const permNamedType = permissionsSchemaFields[key];
          if (permNamedType instanceof GraphQLUnionType) {
            permissionsTypesVal = permNamedType.getTypes();
          } else {
            isFieldPresent = false;
          }
        } else {
          isFieldPresent = false;
        }
      }
      type.name = `union ${typeName}`;
      const typesVal = value.getTypes();
      const childArray: CustomFieldType[] = [];
      typesVal.forEach((v) => {
        const checked = Boolean(
          permissionsSchema &&
            isFieldPresent &&
            permissionsTypesVal.some((t) => t.name === v.name),
        );
        childArray.push({ name: v.name, checked, return: v.name });
      });
      type.children = childArray;
      unionTypes.push(type);
      return;
    }

    if (value instanceof GraphQLInterfaceType) {
      let isFieldPresent = true;
      const permissionsFieldNames: Record<string, true> = {};
      if (permissionsSchema && permissionsSchemaFields) {
        if (key in permissionsSchemaFields) {
          const permNamedType = permissionsSchemaFields[key];
          if (
            permNamedType instanceof GraphQLObjectType ||
            permNamedType instanceof GraphQLInterfaceType
          ) {
            const permFields = permNamedType.getFields();
            Object.keys(permFields).forEach((fname) => {
              permissionsFieldNames[fname] = true;
            });
          } else {
            isFieldPresent = false;
          }
        } else {
          isFieldPresent = false;
        }
      }
      type.name = `interface ${typeName}`;
      const fieldVal = value.getFields();
      const childArray: CustomFieldType[] = [];
      Object.entries(fieldVal).forEach(([k, v]) => {
        const checked = Boolean(
          permissionsSchema && isFieldPresent && k in permissionsFieldNames,
        );
        childArray.push({ name: v.name, checked, return: v.type.toString() });
      });
      type.children = childArray;
      interfaceTypes.push(type);
    }
  });

  return [
    ...objectTypes,
    ...inputObjectTypes,
    ...unionTypes,
    ...enumTypes,
    ...scalarTypes,
    ...interfaceTypes,
  ];
}

export default function buildRemoteSchemaFieldTree(
  schema: GraphQLSchema,
  permissionsSchema: GraphQLSchema | null,
): RemoteSchemaFields[] {
  const types = getType(schema, permissionsSchema);

  const queryRootName = schema.getQueryType()?.name;
  const mutationRootName = schema.getMutationType()?.name;

  const roots: RemoteSchemaFields[] = [];

  if (queryRootName) {
    roots.push({
      name: `type ${queryRootName}`,
      typeName: '__query_root',
      children: getTree(schema, permissionsSchema, 'QUERY'),
    });
  }

  if (mutationRootName) {
    roots.push({
      name: `type ${mutationRootName}`,
      typeName: '__mutation_root',
      children: getTree(schema, permissionsSchema, 'MUTATION'),
    });
  }

  return roots.concat(types);
}
