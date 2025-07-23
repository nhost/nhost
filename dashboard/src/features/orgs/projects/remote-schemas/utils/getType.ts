import type { GraphQLFieldMap, GraphQLSchema } from 'graphql';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
} from 'graphql';
import type {
  ArgTreeType,
  CustomFieldType,
  FieldType,
  RemoteSchemaFields,
} from '../types';

export type GetTypeResult = {
  type: string;
  isList?: boolean;
  isObject?: boolean;
};

const getSchemaRoots = (schema: GraphQLSchema) => {
  if (!schema) {
    return [];
  }
  const res = [schema.getQueryType()?.name]; // query root will be always present
  if (schema.getMutationType()?.name) {
    res.push(schema.getMutationType()?.name);
  }
  if (schema.getSubscriptionType()?.name) {
    res.push(schema.getSubscriptionType()?.name);
  }
  return res;
};

/**
 * Sets input types, object types, scalar types and enum types in UI tree.
 * @param introspectionSchema - Remote schema introspection schema.
 * @param permissionsSchema - Permissions coming from saved role.
 * @returns Array of all types
 */
export const getType = (
  introspectionSchema: GraphQLSchema | null,
  permissionsSchema: GraphQLSchema | null,
) => {
  const introspectionSchemaFields = introspectionSchema!.getTypeMap();

  let permissionsSchemaFields: any = null;
  if (permissionsSchema !== null) {
    permissionsSchemaFields = permissionsSchema!.getTypeMap();
  }

  const enumTypes: RemoteSchemaFields[] = [];
  const scalarTypes: RemoteSchemaFields[] = [];
  const inputObjectTypes: RemoteSchemaFields[] = [];
  const objectTypes: RemoteSchemaFields[] = [];
  const unionTypes: RemoteSchemaFields[] = [];
  const interfaceTypes: RemoteSchemaFields[] = [];

  Object.entries(introspectionSchemaFields).forEach(([key, value]: any) => {
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

    const { name } = value;
    const roots = introspectionSchema
      ? getSchemaRoots(introspectionSchema)
      : [];

    if (roots.includes(name)) {
      return;
    }

    if (name.startsWith('__')) {
      return;
    }

    const type: RemoteSchemaFields = {
      name: ``,
      typeName: ``,
      children: [],
    };
    type.typeName = name;

    if (value instanceof GraphQLEnumType) {
      type.name = `enum ${name}`;
      const values = value.getValues();
      const childArray: CustomFieldType[] = [];
      let checked = false;
      if (
        permissionsSchema !== null &&
        permissionsSchemaFields !== null &&
        key in permissionsSchemaFields
      ) {
        checked = true;
      }
      values.forEach((val) => {
        childArray.push({
          name: val.name,
          checked,
        });
      });
      type.children = childArray;
      enumTypes.push(type);
    } else if (value instanceof GraphQLScalarType) {
      type.name = `scalar ${name}`;
      let checked = false;
      if (
        permissionsSchema !== null &&
        permissionsSchemaFields !== null &&
        key in permissionsSchemaFields
      ) {
        checked = true;
      }
      const childArray: CustomFieldType[] = [{ name: type.name, checked }];
      type.children = childArray;
      scalarTypes.push(type);
    } else if (value instanceof GraphQLObjectType) {
      type.name = `type ${name}`;
      if (value.getInterfaces().length) {
        const implementsString = value
          .getInterfaces()
          .map((i: any) => i.name)
          .join('& ');
        type.name = `type ${name} implements ${implementsString}`;
      }
    } else if (value instanceof GraphQLInputObjectType) {
      type.name = `input ${name}`;
    }

    if (
      value instanceof GraphQLObjectType ||
      value instanceof GraphQLInputObjectType
    ) {
      const childArray: CustomFieldType[] = [];
      const fieldVal = value.getFields();
      let permissionsFieldVal: GraphQLFieldMap<any, any> = {};
      let isFieldPresent = true;

      // Check if the type is present in the permission schema coming from user.
      if (permissionsSchema !== null && permissionsSchemaFields !== null) {
        if (key in permissionsSchemaFields) {
          permissionsFieldVal = permissionsSchemaFields[key].getFields();
        } else {
          isFieldPresent = false;
        }
      }

      // Checked is true when type is present and the fields are present in type
      Object.entries(fieldVal).forEach(([k, v]) => {
        let checked = false;
        if (
          permissionsSchema !== null &&
          isFieldPresent &&
          k in permissionsFieldVal
        ) {
          checked = true;
        }
        const field: CustomFieldType = {
          name: v.name,
          checked,
          return: v.type.toString(),
        };
        if (v.defaultValue !== undefined) {
          field.defaultValue = v.defaultValue;
        }
        if (value instanceof GraphQLInputObjectType) {
          field.args = { [k]: v };
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
    }

    if (value instanceof GraphQLUnionType) {
      let isFieldPresent = true;
      let permissionsTypesVal: any;

      // Check if the type is present in the permission schema coming from user.
      if (permissionsSchema !== null && permissionsSchemaFields !== null) {
        if (key in permissionsSchemaFields) {
          permissionsTypesVal = permissionsSchemaFields[key].getTypes();
        } else {
          isFieldPresent = false;
        }
      }

      type.name = `union ${name}`;
      const childArray: CustomFieldType[] = [];
      const typesVal = value.getTypes();
      Object.entries(typesVal).forEach(([k, v]) => {
        let checked = false;
        if (
          permissionsSchema !== null &&
          isFieldPresent &&
          k in permissionsTypesVal
        ) {
          checked = true;
        }
        const field: CustomFieldType = {
          name: v.name,
          checked,
          return: v.name,
        };
        childArray.push(field);
      });

      type.children = childArray;
      unionTypes.push(type);
    }

    if (value instanceof GraphQLInterfaceType) {
      let isFieldPresent = true;
      let permissionsFieldVal: GraphQLFieldMap<any, any> = {};

      // Check if the type is present in the permission schema coming from user.
      if (permissionsSchema !== null && permissionsSchemaFields !== null) {
        if (key in permissionsSchemaFields) {
          permissionsFieldVal = permissionsSchemaFields[key].getFields();
        } else {
          isFieldPresent = false;
        }
      }

      type.name = `interface ${name}`;
      const childArray: CustomFieldType[] = [];
      const fieldVal = value.getFields();
      Object.entries(fieldVal).forEach(([k, v]) => {
        let checked = false;
        if (
          permissionsSchema !== null &&
          isFieldPresent &&
          k in permissionsFieldVal
        ) {
          checked = true;
        }
        const field: CustomFieldType = {
          name: v.name,
          checked,
          return: v.type.toString(),
        };
        childArray.push(field);
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
};
