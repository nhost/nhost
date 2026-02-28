import { type GraphQLInputField, GraphQLList } from 'graphql';
import { isJSONString } from '@/lib/utils';

function isJSONArrayLiteral(str: string) {
  if (!isJSONString(str)) {
    return false;
  }
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed);
  } catch {
    return false;
  }
}

export default function isList(gqlArg: GraphQLInputField, value: string) {
  if (!(gqlArg?.type instanceof GraphQLList)) {
    return false;
  }
  if (typeof value !== 'string') {
    return false;
  }
  if (value.toLowerCase().startsWith('x-hasura')) {
    return false;
  }
  return isJSONArrayLiteral(value);
}
