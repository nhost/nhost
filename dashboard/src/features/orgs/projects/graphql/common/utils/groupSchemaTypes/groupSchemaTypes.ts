import {
  type GraphQLNamedType,
  type GraphQLSchema,
  getNamedType,
  isListType,
  isNonNullType,
  isObjectType,
} from 'graphql';

// Types a query root field lists, like `users: [users!]!`.
function getListedTypeNames(schema: GraphQLSchema) {
  const rootFields = Object.values(schema.getQueryType()?.getFields() ?? {});

  return new Set(
    rootFields
      .filter((field) =>
        isListType(isNonNullType(field.type) ? field.type.ofType : field.type),
      )
      .map((field) => getNamedType(field.type).name),
  );
}

// A table is listed by a query root field and filtered with a
// "<table>_bool_exp" input. "<table>_aggregate" can't tell: it only exists for
// roles allowed to aggregate.
function isListedTable(
  schema: GraphQLSchema,
  listedTypeNames: Set<string>,
  type: GraphQLNamedType,
) {
  return (
    isObjectType(type) &&
    listedTypeNames.has(type.name) &&
    `${type.name}_bool_exp` in schema.getTypeMap()
  );
}

/**
 * Whether a type is a table the schema's role can list rows of.
 */
export function isTableType(schema: GraphQLSchema, type: GraphQLNamedType) {
  return isListedTable(schema, getListedTypeNames(schema), type);
}

/**
 * Splits a schema's types into tables and everything else, sorted by name.
 * Built in types (`__Type`…) and the root types are left out.
 */
export default function groupSchemaTypes(
  schema: GraphQLSchema | null | undefined,
) {
  if (!schema) {
    return { tables: [], otherTypes: [] };
  }

  const rootTypeNames = new Set(
    [
      schema.getQueryType(),
      schema.getMutationType(),
      schema.getSubscriptionType(),
    ].map((type) => type?.name),
  );
  const types = Object.values(schema.getTypeMap())
    .filter(
      (type) => !type.name.startsWith('__') && !rootTypeNames.has(type.name),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const listedTypeNames = getListedTypeNames(schema);
  const isTable = (type: GraphQLNamedType) =>
    isListedTable(schema, listedTypeNames, type);

  return {
    tables: types.filter(isTable),
    otherTypes: types.filter((type) => !isTable(type)),
  };
}
