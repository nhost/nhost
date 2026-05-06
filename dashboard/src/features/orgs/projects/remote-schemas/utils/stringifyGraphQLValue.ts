import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  type GraphQLInputField,
  type GraphQLInputType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql';
import type {
  ArgLeafType,
  ArgTreeType,
} from '@/features/orgs/projects/remote-schemas/types';
import stringifyGraphQLInputObject from './stringifyGraphQLInputObject';

function unwrapToBaseInputType(type: GraphQLInputType): GraphQLInputType {
  if (type instanceof GraphQLList || type instanceof GraphQLNonNull) {
    const inner = (
      type as GraphQLList<GraphQLInputType> | GraphQLNonNull<GraphQLInputType>
    ).ofType as GraphQLInputType;
    return unwrapToBaseInputType(inner);
  }
  return type;
}

function isSessionVariable(value: string): boolean {
  return value.toLowerCase().startsWith('x-hasura');
}

function isEnumValueLiteral(
  argName: unknown,
  argType: GraphQLInputType,
): boolean {
  if (typeof argName !== 'string') {
    return false;
  }
  if (isSessionVariable(argName)) {
    return false;
  }
  return unwrapToBaseInputType(argType) instanceof GraphQLEnumType;
}

function isBooleanLiteral(
  argName: unknown,
  argType: GraphQLInputType,
): boolean {
  if (unwrapToBaseInputType(argType) !== GraphQLBoolean) {
    return false;
  }
  if (typeof argName === 'boolean') {
    return true;
  }
  if (typeof argName !== 'string') {
    return false;
  }
  if (isSessionVariable(argName)) {
    return false;
  }
  return argName === 'true' || argName === 'false';
}

function isNumericLiteral(
  argName: unknown,
  argType: GraphQLInputType,
): boolean {
  const baseType = unwrapToBaseInputType(argType);
  if (baseType !== GraphQLInt && baseType !== GraphQLFloat) {
    return false;
  }
  if (typeof argName === 'number') {
    return Number.isFinite(argName);
  }
  if (typeof argName !== 'string') {
    return false;
  }
  if (isSessionVariable(argName)) {
    return false;
  }
  if (argName.trim() === '') {
    return false;
  }
  const n = Number(argName);
  if (baseType === GraphQLInt) {
    return Number.isInteger(n);
  }
  return Number.isFinite(n);
}

function isUnquotedNullType(argType: GraphQLInputType): boolean {
  const baseType = unwrapToBaseInputType(argType);
  return (
    baseType === GraphQLBoolean ||
    baseType === GraphQLInt ||
    baseType === GraphQLFloat ||
    baseType instanceof GraphQLEnumType
  );
}

export interface FormatParamArgs {
  argName: ArgTreeType | ArgLeafType;
  arg: GraphQLInputField;
}

export default function stringifyGraphQLValue({
  argName,
  arg,
}: FormatParamArgs): string | undefined {
  if (argName === null) {
    return isUnquotedNullType(arg.type) ? 'null' : '"null"';
  }

  if (typeof argName === 'object') {
    if (Array.isArray(argName)) {
      const items = argName.map((item) =>
        stringifyGraphQLValue({ arg, argName: item }),
      );
      return `[${items.join(',')}]`;
    }
    return stringifyGraphQLInputObject(argName, arg);
  }

  if (
    isBooleanLiteral(argName, arg.type) ||
    isEnumValueLiteral(argName, arg.type)
  ) {
    return String(argName);
  }

  if (isNumericLiteral(argName, arg.type)) {
    return String(Number(argName));
  }

  return `"${argName}"`;
}
