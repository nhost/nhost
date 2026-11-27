import {
  type GraphQLNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
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
