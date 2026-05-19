import { createContext, useContext } from 'react';
import type { useDataBrowserActions } from '@/features/orgs/projects/database/dataGrid/hooks/useDataBrowserActions';

type DataBrowserActions = ReturnType<typeof useDataBrowserActions>;

export interface TableActionsContextValue {
  actions: DataBrowserActions;
  trackedTablesSet: Set<string> | undefined;
}

const TableActionsContext = createContext<TableActionsContextValue | null>(
  null,
);

export const TableActionsProvider = TableActionsContext.Provider;

export function useTableActionsContext(): TableActionsContextValue | null {
  return useContext(TableActionsContext);
}
