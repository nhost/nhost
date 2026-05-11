import type { GraphQLInputField, GraphQLInputFieldMap } from 'graphql';
import type { ArgTreeType } from '@/features/orgs/projects/remote-schemas/types';
import { isEmptyValue } from '@/lib/utils';
import getInputFieldChildren from './getInputFieldChildren';
import parsePresetValue from './presetExpression/parsePresetValue';
import serializePresetExpression from './presetExpression/serializePresetExpression';

export default function stringifyGraphQLInputObject(
  args: ArgTreeType,
  argDef: GraphQLInputField,
): string | undefined {
  if (args === null) {
    return 'null';
  }

  const { children } = getInputFieldChildren(argDef);
  if (isEmptyValue(children)) {
    return undefined;
  }
  const gqlArgs = children as GraphQLInputFieldMap;

  const entries: string[] = [];
  for (const [key, value] of Object.entries(args)) {
    if (isEmptyValue(value)) {
      continue;
    }
    const gqlArg = gqlArgs[key];
    if (!gqlArg) {
      continue;
    }
    const literal = serializePresetExpression(
      parsePresetValue(value, gqlArg.type),
      gqlArg,
    );
    if (literal !== undefined) {
      entries.push(`${key}: ${literal}`);
    }
  }

  if (entries.length === 0) {
    return undefined;
  }
  return `{ ${entries.join(', ')} }`;
}
