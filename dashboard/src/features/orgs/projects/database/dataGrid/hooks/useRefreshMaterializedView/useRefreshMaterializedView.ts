import { triggerToast } from '@/utils/toast';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useRefreshMaterializedViewMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useRefreshMaterializedViewMutation';

export interface UseRefreshMaterializedViewOptions {
  currentTablePath: string;
}

export default function useRefreshMaterializedView({
  currentTablePath,
}: UseRefreshMaterializedViewOptions) {
  const {
    query: { schemaSlug, tableSlug },
  } = useRouter();
  const queryClient = useQueryClient();

  const { mutateAsync, status } = useRefreshMaterializedViewMutation();

  async function handleRefresh() {
    if (typeof schemaSlug !== 'string' || typeof tableSlug !== 'string') {
      return;
    }

    try {
      await mutateAsync({ schema: schemaSlug, table: tableSlug });
      await queryClient.invalidateQueries({
        queryKey: [currentTablePath],
        refetchType: 'inactive',
      });

      triggerToast('The materialized view has been refreshed successfully.');
    } catch (error) {
      triggerToast(
        error instanceof Error
          ? error.message
          : 'An error occurred while refreshing the materialized view.',
      );
    }
  }

  return { handleRefresh, isRefreshing: status === 'loading' };
}