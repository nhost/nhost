import type { GraphQLInputField } from 'graphql';
import type {
  ArgLeafType,
  ArgTreeType,
} from '@/features/orgs/projects/remote-schemas/types';
import parsePresetExpression from './presetExpression/parsePresetExpression';
import serializePresetExpression from './presetExpression/serializePresetExpression';

export interface FormatParamArgs {
  argName: ArgTreeType | ArgLeafType;
  arg: GraphQLInputField;
}

export default function stringifyGraphQLValue({
  argName,
  arg,
}: FormatParamArgs): string | undefined {
  return serializePresetExpression(
    parsePresetExpression(argName, arg.type),
    arg,
  );
}
