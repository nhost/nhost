const FIELD_LABELS = {
  definition: 'Action Definition',
  types: 'Type Configuration',
} as const;

export interface BuildActionSdlPromptParams {
  /** Which editor the prompt is being generated for. */
  target: 'definition' | 'types';
  actionDefinitionSdl: string;
  typesSdl: string;
}

/**
 * Builds a copy-paste prompt that helps an LLM author one of the two GraphQL
 * SDL editors of an action. It teaches the model the field's format, includes
 * the current content of both editors so it can refine rather than restart,
 * and leaves a slot for the developer's intent.
 */
export default function buildActionSdlPrompt({
  target,
  actionDefinitionSdl,
  typesSdl,
}: BuildActionSdlPromptParams): string {
  const definitionBlock = actionDefinitionSdl.trim() || '(empty)';
  const typesBlock = typesSdl.trim() || '(empty)';

  const task =
    target === 'definition'
      ? 'Write the **Action Definition**: a single field defined under `Mutation` or `Query` that matches what I described. Return it in one ```graphql code block. If it needs new or changed types, also return an updated **Type Configuration** in a second ```graphql code block. Keep anything from my current SDL that still applies.'
      : 'Write the **Type Configuration**: the `input` objects, object types, scalars and enums that the Action Definition needs — for both its arguments and its return type. Return it in one ```graphql code block. Do not redeclare the built-in scalars. Keep anything from my current Type Configuration that still applies.';

  return [
    `# Help me write the ${FIELD_LABELS[target]} for an Nhost GraphQL Action`,
    '',
    'A GraphQL Action is a custom GraphQL query or mutation backed by an HTTP handler. In the dashboard it is configured with two GraphQL SDL fields:',
    '',
    '- **Action Definition** — exactly one field defined under `type Mutation { ... }` or `type Query { ... }`. Its arguments and return type may reference custom types.',
    '- **Type Configuration** — the `input` objects, object types, custom `scalar`s and `enum`s used by those arguments and the return type. Do not redeclare the built-in scalars (`String`, `Int`, `Float`, `Boolean`, `ID`). The return (output) type is the JSON shape your handler must return.',
    '',
    '## Current Action Definition',
    '```graphql',
    definitionBlock,
    '```',
    '',
    '## Current Type Configuration',
    '```graphql',
    typesBlock,
    '```',
    '',
    '## What I want',
    '> Describe the action you want to build, or paste a sample response, existing TypeScript types, or an API endpoint.',
    '',
    '## Your task',
    task,
    '',
  ].join('\n');
}
