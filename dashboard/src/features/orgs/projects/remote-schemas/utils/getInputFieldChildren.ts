import type { ChildArgumentType } from '@/features/orgs/projects/remote-schemas/types';
import { isEmptyValue } from '@/lib/utils';
import {
  type GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
} from 'graphql';

export default function getInputFieldChildren(
  field: GraphQLInputField,
): ChildArgumentType {
  if (typeof field === 'string') {
    return {};
  }

  const type = field?.type;

  if (type instanceof GraphQLInputObjectType && type.getFields) {
    return {
      children: type.getFields(),
      path: 'type._fields',
      childrenType: type,
    };
  }

  if (type instanceof GraphQLNonNull || type instanceof GraphQLList) {
    const innerType = type.ofType;
    const { children } = getInputFieldChildren({
      type: innerType,
    } as GraphQLInputField);
    if (isEmptyValue(children)) {
      return {};
    }
    return {
      children,
      path: 'type.ofType',
      childrenType: innerType,
    };
  }

  return {};
}
