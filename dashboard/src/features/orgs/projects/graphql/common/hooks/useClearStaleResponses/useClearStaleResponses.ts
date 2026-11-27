import { pick, useGraphiQL, useGraphiQLActions } from '@graphiql/react';
import { useEffect, useRef } from 'react';
import type { GraphQLPlaygroundSelection } from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';

/**
 * Another user or role makes every response so far stale: it was made as the
 * previous one and would read as the new one's. A running query or open
 * subscription stops, the open tab's response clears, and every other tab's
 * when it is opened (GraphiQL only updates the open tab). Pass a selection
 * that only changes identity on a real change. Call it inside
 * `GraphiQLProvider`.
 */
export default function useClearStaleResponses(
  selection: GraphQLPlaygroundSelection,
) {
  const { tabs, activeTabIndex, responseEditor } = useGraphiQL(
    pick('tabs', 'activeTabIndex', 'responseEditor'),
  );
  const { stop, updateActiveTabValues } = useGraphiQLActions();
  const previousSelection = useRef(selection);
  const staleTabIds = useRef(new Set<string>());
  const activeTabId = tabs[activeTabIndex]?.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: only on a new selection
  useEffect(() => {
    if (previousSelection.current === selection) {
      return;
    }

    previousSelection.current = selection;
    stop();
    staleTabIds.current = new Set(tabs.map((tab) => tab.id));
  }, [selection]);

  // Declared after the effect above, so a new selection clears the open tab
  // in the same commit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selection re-runs it after the effect above marked the open tab stale
  useEffect(() => {
    if (!activeTabId || !staleTabIds.current.has(activeTabId)) {
      return;
    }

    staleTabIds.current.delete(activeTabId);
    // How GraphiQL writes a response.
    responseEditor?.setValue('');
    updateActiveTabValues({ response: '' });
  }, [activeTabId, responseEditor, selection, updateActiveTabValues]);
}
