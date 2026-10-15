import { useParams } from '@tanstack/react-router';
import { useRefreshMaterializedViewMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useRefreshMaterializedViewMutation';
import { triggerToast } from '@/utils/toast';

export interface UseRefreshMaterializedViewOptions {
  refetch: () => Promise<unknown>;
}

export default function useRefreshMaterializedView({
  refetch,
}: UseRefreshMaterializedViewOptions) {
  const { schemaSlug, tableSlug } = useParams({ strict: false });

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
