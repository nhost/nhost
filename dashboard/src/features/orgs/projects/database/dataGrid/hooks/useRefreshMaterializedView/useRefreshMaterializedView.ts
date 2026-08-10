import { useRouter } from 'next/router';
import { useRefreshMaterializedViewMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useRefreshMaterializedViewMutation';
import { triggerToast } from '@/utils/toast';

export interface UseRefreshMaterializedViewOptions {
  refetch: () => Promise<unknown>;
}

export default function useRefreshMaterializedView({
  refetch,
}: UseRefreshMaterializedViewOptions) {
  const {
    query: { schemaSlug, tableSlug },
  } = useRouter();

  const { mutateAsync, status } = useRefreshMaterializedViewMutation();

  async function handleRefresh() {
    if (typeof schemaSlug !== 'string' || typeof tableSlug !== 'string') {
      return;
    }

    try {
      await mutateAsync({ schema: schemaSlug, table: tableSlug });
      await refetch();
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
