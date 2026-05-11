import type { GraphQLInputField } from 'graphql';
import type {
  ArgLeafType,
  ArgTreeType,
} from '@/features/orgs/projects/remote-schemas/types';
import parsePresetValue from './presetExpression/parsePresetValue';
import serializePresetExpression from './presetExpression/serializePresetExpression';

export interface FormatParamArgs {
  argName: ArgTreeType | ArgLeafType;
  arg: GraphQLInputField;
}

export default function stringifyGraphQLValue({
  argName,
  arg,
}: FormatParamArgs): string | undefined {
  return serializePresetExpression(parsePresetValue(argName, arg.type), arg);
}
