import { pick, useGraphiQL, useGraphiQLActions } from '@graphiql/react';
import { useCallback } from 'react';
import { getHistoryKey } from '@/features/orgs/projects/graphql/common/utils/groupHistory';

/**
 * Opens a query without touching the tab you're on: an open tab with the same
 * query and variables becomes active, otherwise it opens in a new tab. Matching
 * works like History's rows, so a run with other variables gets its own tab.
 * The returned function returns false when the query was already open. Call
 * it inside `GraphiQLProvider`.
 */
export default function useOpenQueryInTab() {
  const { tabs, activeTabIndex, queryEditor, variableEditor } = useGraphiQL(
    pick('tabs', 'activeTabIndex', 'queryEditor', 'variableEditor'),
  );
  const { addTab, changeTab, stop } = useGraphiQLActions();

  return useCallback(
    (query: string, variables?: string | null) => {
      const key = getHistoryKey({ query, variables: variables ?? '' });
      const openTabIndex = tabs.findIndex(
        (tab) =>
          getHistoryKey({
            query: tab.query ?? '',
            variables: tab.variables ?? '',
          }) === key,
      );

      if (openTabIndex === activeTabIndex) {
        return false;
      }

      if (openTabIndex !== -1) {
        changeTab(openTabIndex);
        return false;
      }

      // A new tab doesn't stop the run on the tab you leave by itself.
      stop();
      // The new tab starts empty: fill it.
      addTab();
      queryEditor?.setValue(query);
      variableEditor?.setValue(variables ?? '');

      return true;
    },
    [
      activeTabIndex,
      addTab,
      changeTab,
      queryEditor,
      stop,
      tabs,
      variableEditor,
    ],
  );
}
