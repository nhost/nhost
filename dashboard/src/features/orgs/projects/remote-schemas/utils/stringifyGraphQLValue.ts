import type { ArgTreeType } from '@/features/orgs/projects/remote-schemas/types';
import {
  GraphQLEnumType,
  type GraphQLInputField,
  type GraphQLInputType,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql';
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

function isEnumValueLiteral(
  argName: ArgTreeType | string,
  argType: GraphQLInputType,
): boolean {
  if (typeof argName !== 'string') {
    return false;
  }
  if (argName.toLowerCase().startsWith('x-hasura')) {
    return false;
  }

  const baseType = unwrapToBaseInputType(argType);
  return baseType instanceof GraphQLEnumType;
}

export interface FormatParamArgs {
  argName: ArgTreeType | string;
  arg: GraphQLInputField;
}

export default function stringifyGraphQLValue({
  argName,
  arg,
}: FormatParamArgs): string | undefined {
  const isEnum = isEnumValueLiteral(argName, arg.type);

  if (typeof argName === 'object') {
    if (Array.isArray(argName)) {
      const items = argName.map((item) =>
        stringifyGraphQLValue({ arg, argName: item }),
      );
      return `[${items.join(',')}]`;
    }
    return stringifyGraphQLInputObject(argName, arg);
  }

  if (typeof argName === 'number' || isEnum) {
    return String(argName);
  }

  return `"${argName}"`;
}
