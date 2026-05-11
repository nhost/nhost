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
  acceptsBoolean: boolean;
  acceptsNull: boolean;
  acceptsEmptyString: boolean;
  acceptsSessionVariable: boolean;
}

export default function getArgPresetCapabilities(
  arg: GraphQLArgument,
): ArgPresetCapabilities {
  const baseType = unwrapNamedType(arg.type);
  const outer = arg.type instanceof GraphQLNonNull ? arg.type.ofType : arg.type;
  const isList = outer instanceof GraphQLList;
  const isEnum = baseType instanceof GraphQLEnumType;
  const isBoolean = baseType === GraphQLBoolean;
  const isNumeric = baseType === GraphQLInt || baseType === GraphQLFloat;

  return {
    enumValues: !isList && isEnum ? baseType.getValues() : null,
    acceptsBoolean: !isList && isBoolean,
    acceptsNull: !(arg.type instanceof GraphQLNonNull),
    acceptsEmptyString: !isList && !isBoolean && !isNumeric && !isEnum,
    acceptsSessionVariable:
      !isList && (baseType instanceof GraphQLScalarType || isEnum),
  };
}
