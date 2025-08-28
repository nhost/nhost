import type { ArgTreeType } from '@/features/orgs/projects/remote-schemas/types';
import {
  GraphQLEnumType,
  type GraphQLInputType,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql';

const isEnumType = (type: GraphQLInputType): boolean => {
  if (type instanceof GraphQLList || type instanceof GraphQLNonNull) {
    return isEnumType(type.ofType);
  }
  if (type instanceof GraphQLEnumType) {
    return true;
  }
  return false;
};

export default function checkIsEnum(
  argName: ArgTreeType | string,
  argType: GraphQLInputType,
) {
  const isEnum =
    argName &&
    typeof argName === 'string' &&
    !argName.toLowerCase().startsWith('x-hasura') &&
    isEnumType(argType);
  return isEnum;
}
