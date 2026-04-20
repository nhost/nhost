import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useDataGridQueryParams } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';

export function usePageBoundsRedirect(numberOfPages: number, loading: boolean) {
  const router = useRouter();
  const { currentOffset } = useDataGridQueryParams();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router.push/pathname/query are unstable references used only inside the push call — the effect should only fire when the bounds condition changes
  useEffect(() => {
    if (!loading && numberOfPages > 0 && currentOffset >= numberOfPages) {
      router.push({
        pathname: router.pathname,
        query: { ...router.query, page: numberOfPages },
      });
    }
  }, [loading, numberOfPages, currentOffset]);
}
