import type { EditorContextType, ExecutionContextType } from '@graphiql/react';

const sameQuery = (
  a: string | null | undefined,
  b: string | null | undefined,
) => (a ?? '').trim() === (b ?? '').trim();

/**
 * Opens a query without touching the tab you're on: an open tab with the same
 * query becomes active, otherwise it opens in a new tab. Returns false when
 * the query was already open.
 */
export default function openQueryInTab(
  editorContext: EditorContextType,
  executionContext: ExecutionContextType,
  query: string,
  variables?: string | null,
) {
  const openTabIndex = editorContext.tabs.findIndex((tab) =>
    sameQuery(tab.query, query),
  );

  executionContext.stop();

  if (openTabIndex !== -1) {
    editorContext.changeTab(openTabIndex);
    return false;
  }

  editorContext.addTab();

  // The new tab clears the editors first, so fill them right after.
  setTimeout(() => {
    editorContext.queryEditor?.setValue(query);
    editorContext.variableEditor?.setValue(variables ?? '');
  }, 0);

  return true;
}
