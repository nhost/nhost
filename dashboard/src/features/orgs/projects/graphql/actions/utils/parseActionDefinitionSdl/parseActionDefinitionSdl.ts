import type { DocumentNode } from 'graphql';
import { Kind, parse, print } from 'graphql';
import type { InputArgument } from '@/utils/hasura-api/generated/schemas';

export interface ParsedActionDefinition {
  name: string;
  arguments: InputArgument[];
  outputType: string;
  type: 'query' | 'mutation';
}

export type ParseActionDefinitionSdlResult =
  | { definition: ParsedActionDefinition; error: null }
  | { definition: null; error: string };

export default function parseActionDefinitionSdl(
  sdl: string,
): ParseActionDefinitionSdlResult {
  let documentAst: DocumentNode;
  try {
    documentAst = parse(sdl);
  } catch (error) {
    return {
      definition: null,
      error: error instanceof Error ? error.message : 'Invalid SDL',
    };
  }

  if (documentAst.definitions.length !== 1) {
    return {
      definition: null,
      error:
        'The action must be defined under a single "Mutation" or "Query" type',
    };
  }

  const [definitionNode] = documentAst.definitions;

  if (
    definitionNode.kind !== Kind.OBJECT_TYPE_DEFINITION &&
    definitionNode.kind !== Kind.OBJECT_TYPE_EXTENSION
  ) {
    return {
      definition: null,
      error: 'The action must be defined under a "Mutation" or a "Query" type',
    };
  }

  const operationType = definitionNode.name.value;
  if (operationType !== 'Mutation' && operationType !== 'Query') {
    return {
      definition: null,
      error: 'The action must be defined under a "Mutation" or a "Query" type',
    };
  }

  const fields = definitionNode.fields ?? [];
  if (fields.length === 0) {
    return {
      definition: null,
      error: `Define the action as a field under the "${operationType}" type`,
    };
  }

  if (fields.length > 1) {
    const definedActions = fields
      .map((fieldNode) => `"${fieldNode.name.value}"`)
      .join(', ');
    return {
      definition: null,
      error: `Multiple actions are defined (${definedActions}). Please define only one.`,
    };
  }

  const [field] = fields;

  return {
    definition: {
      name: field.name.value,
      arguments: (field.arguments ?? []).map((argument) => ({
        name: argument.name.value,
        type: print(argument.type),
      })),
      outputType: print(field.type),
      type: operationType === 'Query' ? 'query' : 'mutation',
    },
    error: null,
  };
}
