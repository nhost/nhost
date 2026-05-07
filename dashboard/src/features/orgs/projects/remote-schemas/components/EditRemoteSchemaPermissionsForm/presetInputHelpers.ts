import {
  type GraphQLArgument,
  GraphQLBoolean,
  GraphQLEnumType,
  type GraphQLEnumValue,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
} from 'graphql';
import { unwrapToBaseInputType } from '@/features/orgs/projects/remote-schemas/utils/stringifyGraphQLValue';

export function getEnumValuesForArg(
  arg: GraphQLArgument,
): readonly GraphQLEnumValue[] | null {
  const baseType = unwrapToBaseInputType(arg.type);
  return baseType instanceof GraphQLEnumType ? baseType.getValues() : null;
}

export function isBooleanArg(arg: GraphQLArgument): boolean {
  return unwrapToBaseInputType(arg.type) === GraphQLBoolean;
}

export function isNullableArg(arg: GraphQLArgument): boolean {
  return !(arg.type instanceof GraphQLNonNull);
}

export function isListArg(arg: GraphQLArgument): boolean {
  const outer = arg.type instanceof GraphQLNonNull ? arg.type.ofType : arg.type;
  return outer instanceof GraphQLList;
}

export function acceptsEmptyStringLiteral(arg: GraphQLArgument): boolean {
  const baseType = unwrapToBaseInputType(arg.type);
  return (
    baseType !== GraphQLBoolean &&
    baseType !== GraphQLInt &&
    baseType !== GraphQLFloat &&
    !(baseType instanceof GraphQLEnumType)
  );
}

export function acceptsSessionVariable(arg: GraphQLArgument): boolean {
  const baseType = unwrapToBaseInputType(arg.type);
  return (
    baseType instanceof GraphQLScalarType || baseType instanceof GraphQLEnumType
  );
}

export function formatPresetForInput(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}
