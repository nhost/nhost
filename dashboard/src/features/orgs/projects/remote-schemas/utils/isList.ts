import { isJSONString } from '@/lib/utils';
import { type GraphQLInputField, GraphQLList } from 'graphql';

const isArrayString = (str: string) => {
  try {
    if (isJSONString(str) && Array.isArray(JSON.parse(str))) {
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
};

export default function isList(gqlArg: GraphQLInputField, value: string) {
  return (
    gqlArg?.type instanceof GraphQLList &&
    typeof value === 'string' &&
    isArrayString(value) &&
    !value.toLowerCase().startsWith('x-hasura')
  );
}
