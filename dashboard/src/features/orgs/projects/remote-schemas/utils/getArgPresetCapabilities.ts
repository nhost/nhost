import {
  type GraphQLArgument,
  GraphQLBoolean,
  GraphQLEnumType,
  type GraphQLEnumValue,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
} from 'graphql';
import unwrapNamedType from './unwrapNamedType';

export interface ArgPresetCapabilities {
  enumValues: readonly GraphQLEnumValue[] | null;
  isBoolean: boolean;
  isNullable: boolean;
  isList: boolean;
  acceptsEmptyString: boolean;
  acceptsSessionVariable: boolean;
}

export default function getArgPresetCapabilities(
  arg: GraphQLArgument,
): ArgPresetCapabilities {
  const baseType = unwrapNamedType(arg.type);
  const outer = arg.type instanceof GraphQLNonNull ? arg.type.ofType : arg.type;
  const isEnum = baseType instanceof GraphQLEnumType;
  const isBoolean = baseType === GraphQLBoolean;
  const isNumeric = baseType === GraphQLInt || baseType === GraphQLFloat;

  return {
    enumValues: isEnum ? baseType.getValues() : null,
    isBoolean,
    isNullable: !(arg.type instanceof GraphQLNonNull),
    isList: outer instanceof GraphQLList,
    acceptsEmptyString: !isBoolean && !isNumeric && !isEnum,
    acceptsSessionVariable: baseType instanceof GraphQLScalarType || isEnum,
  };
}
