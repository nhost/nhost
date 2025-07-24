import { isEmptyValue } from '@/lib/utils';
import {
  GraphQLEnumType,
  type GraphQLInputField,
  type GraphQLInputFieldMap,
} from 'graphql';
import type { ArgTreeType } from '../types';
import getChildArguments from './getChildArguments';
import isList from './isList';

export default function serialiseArgs(
  args: ArgTreeType,
  argDef: GraphQLInputField,
) {
  let res = '{';
  const { children } = getChildArguments(argDef);

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
      let val;

      const isEnum =
        gqlArg &&
        gqlArg.type instanceof GraphQLEnumType &&
        typeof value === 'string' &&
        !value.toLowerCase().startsWith('x-hasura');

      switch (true) {
        case isEnum:
          val = `${key}:${value}`; // no double quotes
          break;
        case typeof value === 'number':
          val = `${key}: ${value} `;
          break;

        case typeof value === 'string' && isList(gqlArg, value):
          val = `${key}: ${value} `;
          break;

        default:
          val = `${key}:"${value}"`;
          break;
      }

      if (res === '{') {
        res = `${res} ${val}`;
      } else {
        res = `${res} , ${val}`;
      }
    } else if (value && typeof value === 'object') {
      if (children && typeof children === 'object' && gqlArg) {
        const valString = serialiseArgs(value, gqlArg);
        if (valString && res === '{') {
          res = `${res} ${key}: ${valString}`;
        } else if (valString) {
          res = `${res} , ${key}: ${valString}`;
        }
      }
    }
  });
  if (res === `{`) {
    return undefined; // dont return string when there is no value
  }
  return `${res}}`;
}
