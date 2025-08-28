import { isJSONString } from '@/lib/utils';
import { type GraphQLInputField, GraphQLList } from 'graphql';

function isJSONArrayLiteral(str: string) {
  if (!isJSONString(str)) {
    return false;
  }
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed);
  } catch {
    // should be handled by isJSONString
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
