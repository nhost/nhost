import type { ArgTreeType } from '@/features/orgs/projects/remote-schemas/types';
import { isEmptyValue } from '@/lib/utils';
import {
  GraphQLEnumType,
  type GraphQLInputField,
  type GraphQLInputFieldMap,
} from 'graphql';
import getInputFieldChildren from './getInputFieldChildren';
import isList from './isList';

export default function stringifyGraphQLInputObject(
  args: ArgTreeType,
  argDef: GraphQLInputField,
) {
  let result = '{';
  const { children } = getInputFieldChildren(argDef);

  if (args === null) {
    return 'null';
  }

  Object.entries(args).forEach(([key, value]) => {
    if (isEmptyValue(value) || isEmptyValue(children)) {
      return;
    }
    const gqlArgs = children as GraphQLInputFieldMap;
    const gqlArg = gqlArgs[key];

    if (typeof value === 'string' || typeof value === 'number') {
      let fieldLiteral: string;

      const isEnum =
        gqlArg &&
        gqlArg.type instanceof GraphQLEnumType &&
        typeof value === 'string' &&
        !value.toLowerCase().startsWith('x-hasura');

      if (isEnum) {
        fieldLiteral = `${key}:${value}`;
      } else if (typeof value === 'number') {
        fieldLiteral = `${key}: ${value} `;
      } else if (typeof value === 'string' && isList(gqlArg, value)) {
        fieldLiteral = `${key}: ${value} `;
      } else {
        fieldLiteral = `${key}:"${value}"`;
      }

      result =
        result === '{'
          ? `${result} ${fieldLiteral}`
          : `${result} , ${fieldLiteral}`;
    } else if (value && typeof value === 'object') {
      if (children && typeof children === 'object' && gqlArg) {
        const nested = stringifyGraphQLInputObject(value, gqlArg);
        if (nested && result === '{') {
          result = `${result} ${key}: ${nested}`;
        } else if (nested) {
          result = `${result} , ${key}: ${nested}`;
        }
      }
    }
  });

  if (result === '{') {
    return undefined;
  }
  return `${result}}`;
}
