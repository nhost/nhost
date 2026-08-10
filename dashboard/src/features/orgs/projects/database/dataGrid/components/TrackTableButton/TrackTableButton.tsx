import { useRouter } from 'next/router';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsTrackedTable } from '@/features/orgs/projects/database/dataGrid/hooks/useIsTrackedTable';
import { useSetTableTrackingMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetTableTrackingMutation';
import { useTableType } from '@/features/orgs/projects/database/dataGrid/hooks/useTableType';
import {
  getCapitalizedTableLikeObjectTypeLabel,
  getTableLikeObjectTypeLabel,
} from '@/features/orgs/projects/database/dataGrid/utils/getTableLikeObjectTypeLabel/getTableLikeObjectTypeLabel';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

export default function TrackTableButton() {
  const { query } = useRouter();
  const { dataSourceSlug, tableSlug, schemaSlug } = query;

  const { data: isTracked, isLoading: isTrackedLoading } = useIsTrackedTable({
    dataSource: dataSourceSlug as string,
    schema: schemaSlug as string,
    tableName: tableSlug as string,
    enabled:
      typeof dataSourceSlug === 'string' &&
      typeof schemaSlug === 'string' &&
      typeof tableSlug === 'string',
  });

  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const { mutateAsync: setTableTracking, isPending: isMutatingTracking } =
    useSetTableTrackingMutation();
  const { tableType, isLoading: isTableTypeLoading } = useTableType({
    dataSource: dataSourceSlug as string,
    schema: schemaSlug as string,
    name: tableSlug as string,
    queryOptions: {
      enabled:
        typeof dataSourceSlug === 'string' &&
        typeof schemaSlug === 'string' &&
        typeof tableSlug === 'string',
    },
  });
  const objectLabel = getTableLikeObjectTypeLabel(tableType);
  const capitalizedObjectLabel =
    getCapitalizedTableLikeObjectTypeLabel(tableType);

  const handleTrack = async () => {
    await execPromiseWithErrorToast(
      async () => {
        await setTableTracking({
          tracked: true,
          resourceVersion,
          args: {
            source: dataSourceSlug as string,
            table: {
              name: tableSlug as string,
              schema: schemaSlug as string,
            },
          },
        });
      },
      {
        successMessage: `${capitalizedObjectLabel} tracked successfully.`,
        loadingMessage: `Tracking ${objectLabel}...`,
        errorMessage: `Failed to track ${objectLabel}.`,
      },
    );
  };

  if (isTrackedLoading || isTableTypeLoading || isTracked) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden h-2 w-2 shrink-0 rounded-full bg-amber-500 sm:inline-block" />
      <span className="hidden font-medium text-amber-600 text-sm sm:inline dark:text-amber-400">
        Not tracked in GraphQL
      </span>
      <Button
        onClick={handleTrack}
        disabled={isMutatingTracking}
        loading={isMutatingTracking}
        size="sm"
        variant="outline"
        className="border-amber-500/30 text-amber-600 text-sm hover:bg-amber-500/10 dark:text-amber-400"
      >
        <span className="sm:hidden">Track</span>
        <span className="hidden sm:inline">Track now</span>
      </Button>
    </div>
  );
}
