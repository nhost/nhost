import type { ChildArgumentType } from '@/features/orgs/projects/remote-schemas/types';
import { isEmptyValue } from '@/lib/utils';
import {
  type GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql';

// method that tells whether the field is nested or not, if nested it returns the children
export default function getChildArguments(
  v: GraphQLInputField,
): ChildArgumentType {
  if (typeof v === 'string') {
    return {};
  } // value field
  if (v?.type instanceof GraphQLInputObjectType && v?.type?.getFields) {
    return {
      children: v?.type?.getFields(),
      path: 'type._fields',
      childrenType: v?.type,
    };
  }

  // 1st order
  if (v?.type instanceof GraphQLNonNull || v?.type instanceof GraphQLList) {
    const { children } = getChildArguments({
      type: v?.type.ofType,
    } as GraphQLInputField);
    if (isEmptyValue(children)) {
      return {};
    }

    return {
      children,
      path: 'type.ofType',
      childrenType: v?.type?.ofType,
    };
  }

  return {};
}
