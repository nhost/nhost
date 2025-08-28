import type {
  ArgTreeType,
  CustomFieldType,
  FieldType,
  RemoteSchemaFields,
} from '@/features/orgs/projects/remote-schemas/types';
import {
  GraphQLEnumType,
  type GraphQLFieldMap,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  type GraphQLSchema,
  GraphQLUnionType,
} from 'graphql';
import getSchemaRoots from './getSchemaRoots';

// Returns array of schema fields (query_root and mutation_root)
function getTree(
  introspectionSchema: GraphQLSchema | null,
  permissionsSchema: GraphQLSchema | null,
  typeS: string,
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
  const permFields: GraphQLFieldMap<any, any> | null = permType
    ? (permType.getFields?.() ?? null)
    : null;

  const parentName = `type ${baseType?.name}`;

  return Object.values(baseFields).map((field: any) => {
    const { name, args: argArray, type, ...rest } = field;
    const args = (argArray ?? []).reduce(
      (p: ArgTreeType, c: FieldType) => ({ ...p, [c.name]: { ...c } }),
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
    };
  });
}

/**
 * Collects input/object/scalar/enum/union/interface types for the types tree.
 */
function getType(
  introspectionSchema: GraphQLSchema | null,
  permissionsSchema: GraphQLSchema | null,
) {
  const introspectionSchemaFields = introspectionSchema!.getTypeMap();
  const permissionsSchemaFields = permissionsSchema
    ? permissionsSchema.getTypeMap()
    : null;

  const enumTypes: RemoteSchemaFields[] = [];
  const scalarTypes: RemoteSchemaFields[] = [];
  const inputObjectTypes: RemoteSchemaFields[] = [];
  const objectTypes: RemoteSchemaFields[] = [];
  const unionTypes: RemoteSchemaFields[] = [];
  const interfaceTypes: RemoteSchemaFields[] = [];

  const roots = introspectionSchema ? getSchemaRoots(introspectionSchema) : [];

  const isPermittedType = (typeKey: string) =>
    Boolean(
      permissionsSchema &&
        permissionsSchemaFields &&
        typeKey in (permissionsSchemaFields as any),
    );

  Object.entries(introspectionSchemaFields).forEach(([key, value]: any) => {
    // Only process concrete GraphQL types
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
      return; // skip root operation types
    }
    if (typeName.startsWith('__')) {
      return; // skip introspection types
    }

    const type: RemoteSchemaFields = { name: ``, typeName, children: [] };

    // Headline by kind
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
          .map((i: any) => i.name)
          .join('& ');
        type.name = `type ${typeName} implements ${implementsString}`;
      }
    } else if (value instanceof GraphQLInputObjectType) {
      type.name = `input ${typeName}`;
    }

    // Fields for object and input types
    if (
      value instanceof GraphQLObjectType ||
      value instanceof GraphQLInputObjectType
    ) {
      const fieldVal = value.getFields();
      let permissionsFieldVal: GraphQLFieldMap<any, any> = {};
      let isFieldPresent = true;

      if (permissionsSchema && permissionsSchemaFields) {
        if (key in (permissionsSchemaFields as any)) {
          permissionsFieldVal = (permissionsSchemaFields as any)[
            key
          ].getFields();
        } else {
          isFieldPresent = false;
        }
      }

      const childArray: CustomFieldType[] = [];
      Object.entries(fieldVal).forEach(([k, v]) => {
        const checked = Boolean(
          permissionsSchema && isFieldPresent && k in permissionsFieldVal,
        );
        const field: CustomFieldType = {
          name: v.name,
          checked,
          return: v.type.toString(),
        };
        if (v.defaultValue !== undefined) {
          field.defaultValue = v.defaultValue;
        }

        if (value instanceof GraphQLInputObjectType) {
          field.args = { [k]: v } as any;
          field.isInputObjectType = true;
          field.parentName = type.name;
        } else if (v.args?.length) {
          field.args = v.args.reduce(
            (p: ArgTreeType, c: FieldType) => ({ ...p, [c.name]: { ...c } }),
            {},
          );
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

    // Union types
    if (value instanceof GraphQLUnionType) {
      let isFieldPresent = true;
      let permissionsTypesVal: any;
      if (permissionsSchema && permissionsSchemaFields) {
        if (key in (permissionsSchemaFields as any)) {
          permissionsTypesVal = (permissionsSchemaFields as any)[
            key
          ].getTypes();
        } else {
          isFieldPresent = false;
        }
      }
      type.name = `union ${typeName}`;
      const typesVal = value.getTypes();
      const childArray: CustomFieldType[] = [];
      Object.entries(typesVal).forEach(([k, v]) => {
        const checked = Boolean(
          permissionsSchema && isFieldPresent && k in permissionsTypesVal,
        );
        childArray.push({ name: v.name, checked, return: v.name });
      });
      type.children = childArray;
      unionTypes.push(type);
      return;
    }

    // Interface types
    if (value instanceof GraphQLInterfaceType) {
      let isFieldPresent = true;
      let permissionsFieldVal: GraphQLFieldMap<any, any> = {};
      if (permissionsSchema && permissionsSchemaFields) {
        if (key in (permissionsSchemaFields as any)) {
          permissionsFieldVal = (permissionsSchemaFields as any)[
            key
          ].getFields();
        } else {
          isFieldPresent = false;
        }
      }
      type.name = `interface ${typeName}`;
      const fieldVal = value.getFields();
      const childArray: CustomFieldType[] = [];
      Object.entries(fieldVal).forEach(([k, v]) => {
        const checked = Boolean(
          permissionsSchema && isFieldPresent && k in permissionsFieldVal,
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
