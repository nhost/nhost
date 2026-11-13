import { Kind, parse } from 'graphql';

// GraphiQL's title for a query without an operation name.
export const UNNAMED_QUERY_TITLE = '<untitled>';

/**
 * A short name for a query, used on tabs and in history. A named operation
 * keeps its name. An unnamed one shows the first field it asks for (e.g.
 * "users"), and an empty query shows "New query".
 */
export function getQueryLabel(query: string | null | undefined) {
  const trimmed = query?.trim();

  if (!trimmed) {
    return 'New query';
  }

  try {
    const document = parse(trimmed);
    const operation = document.definitions.find(
      (definition) => definition.kind === Kind.OPERATION_DEFINITION,
    );

    if (operation?.kind === Kind.OPERATION_DEFINITION && operation.name) {
      return operation.name.value;
    }

    const firstField =
      operation?.kind === Kind.OPERATION_DEFINITION
        ? operation.selectionSet.selections.find(
            (selection) => selection.kind === Kind.FIELD,
          )
        : undefined;

    if (firstField?.kind === Kind.FIELD) {
      return firstField.name.value;
    }
  } catch {
    // The query is not valid yet (e.g. while typing). Fall back to a simple
    // match on the first field after the opening brace.
  }

  const match = trimmed
    .replace(/#.*$/gm, '')
    .match(/\{\s*(?:[_A-Za-z][_0-9A-Za-z]*\s*:\s*)?([_A-Za-z][_0-9A-Za-z]*)/);

  return match?.[1] ?? 'New query';
}
