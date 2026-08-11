import { parse, print } from 'graphql';
import type {
  ActionDefinition,
  ActionItem,
} from '@/utils/hasura-api/generated/schemas';

export type ComposeActionDefinitionSdlParams = Pick<ActionItem, 'name'> & {
  definition: Pick<ActionDefinition, 'arguments' | 'output_type' | 'type'>;
};

export default function composeActionDefinitionSdl({
  name,
  definition,
}: ComposeActionDefinitionSdlParams): string {
  const operationType = definition.type === 'query' ? 'Query' : 'Mutation';
  const actionArguments = definition.arguments ?? [];
  const argumentsSdl = actionArguments.length
    ? `(${actionArguments
        .map((argument) => `${argument.name}: ${argument.type}`)
        .join(', ')})`
    : '';

  const sdl = `type ${operationType} {\n  ${name}${argumentsSdl}: ${definition.output_type}\n}`;
  return `${print(parse(sdl)).trim()}\n`;
}
