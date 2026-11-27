import {
  type GraphQLNamedType,
  type GraphQLSchema,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isNamedType,
  isObjectType,
  isScalarType,
  isUnionType,
} from 'graphql';

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/** How many fields (or values, or members) a type has, e.g. "6 fields". */
export function getMemberCount(type: GraphQLNamedType): string | null {
  if (isObjectType(type) || isInterfaceType(type) || isInputObjectType(type)) {
    return plural(Object.keys(type.getFields()).length, 'field', 'fields');
  }

  if (isEnumType(type)) {
    return plural(type.getValues().length, 'value', 'values');
  }

  if (isUnionType(type)) {
    return plural(type.getTypes().length, 'type', 'types');
  }

  return null;
}

/**
 * The small tag next to a docs title: what the open page is. Anything that
 * isn't a type (a field or an argument) is a field.
 */
export function getDocsKind(def: unknown, schema: GraphQLSchema): string {
  if (!isNamedType(def)) {
    return 'field';
  }

  const rootTypes = [
    schema.getQueryType(),
    schema.getMutationType(),
    schema.getSubscriptionType(),
  ];

  if (rootTypes.includes(def as never)) {
    return 'root';
  }

  if (`${def.name}_aggregate` in schema.getTypeMap()) {
    return 'table';
  }

  if (isInputObjectType(def)) {
    return 'input';
  }

  if (isEnumType(def)) {
    return 'enum';
  }

  if (isScalarType(def)) {
    return 'scalar';
  }

  if (isInterfaceType(def)) {
    return 'interface';
  }

  if (isUnionType(def)) {
    return 'union';
  }

  return 'type';
}
