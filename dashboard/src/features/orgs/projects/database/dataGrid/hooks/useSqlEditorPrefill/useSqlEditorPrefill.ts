import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

const SQL_EDITOR_PREFILL_KEY = ['sql-editor-prefill'] as const;

/**
 * Hook for prefilling the SQL editor with a query from another component.
 *
 * Uses TanStack Query's cache as a reactive signaling mechanism so the
 * SQLEditor picks up changes even when it's already mounted (e.g.
 * navigating to the same editor URL from a different view).
 *
 * @returns `prefillSql` — the current prefill SQL string, or `null`.
 * @returns `prefill` — sets the SQL to prefill the editor with.
 * @returns `consumePrefill` — reads and clears the prefill SQL.
 */
export default function useSqlEditorPrefill() {
  const queryClient = useQueryClient();

  const { data: prefillSql = null } = useQuery<string | null>({
    queryKey: SQL_EDITOR_PREFILL_KEY,
    queryFn: () => null,
    enabled: false,
    initialData: null,
  });

  const prefill = useCallback(
    (sql: string) => {
      queryClient.setQueryData<string | null>(SQL_EDITOR_PREFILL_KEY, sql);
    },
    [queryClient],
  );

  const consumePrefill = useCallback(() => {
    const current =
      queryClient.getQueryData<string | null>(SQL_EDITOR_PREFILL_KEY) ?? null;
    queryClient.setQueryData<string | null>(SQL_EDITOR_PREFILL_KEY, null);
    return current;
  }, [queryClient]);

  return { prefillSql, prefill, consumePrefill };
}
