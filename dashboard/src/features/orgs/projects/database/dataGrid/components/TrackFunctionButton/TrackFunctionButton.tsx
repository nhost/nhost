import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useGetTrackedTablesSet } from '@/features/orgs/projects/database/dataGrid/hooks/useGetTrackedTablesSet';
import { useIsTrackedFunction } from '@/features/orgs/projects/database/dataGrid/hooks/useIsTrackedFunction';
import { useSetFunctionTrackingMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetFunctionTrackingMutation';
import { useSetTableTrackingMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetTableTrackingMutation';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { ExportMetadataResponse } from '@/utils/hasura-api/generated/schemas';

export interface TrackFunctionButtonProps {
  schema: string;
  functionName: string;
  returnTableName?: string | null;
  returnTableSchema?: string | null;
}

export default function TrackFunctionButton({
  schema,
  functionName,
  returnTableName,
  returnTableSchema,
}: TrackFunctionButtonProps) {
  const { query } = useRouter();
  const { dataSourceSlug } = query;
  const dataSource = (dataSourceSlug as string) || 'default';
  const { project } = useProject();
  const queryClient = useQueryClient();

  const { data: isTracked, isLoading: isTrackedLoading } = useIsTrackedFunction(
    {
      dataSource,
      schema,
      functionName,
      enabled: typeof dataSourceSlug === 'string' && !!schema && !!functionName,
    },
  );

  const { data: trackedTablesSet } = useGetTrackedTablesSet({ dataSource });

  const isReturnTableUntracked =
    !!returnTableName &&
    !!returnTableSchema &&
    !trackedTablesSet?.has(`${returnTableSchema}.${returnTableName}`);

  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const { mutateAsync: setFunctionTracking, isPending: isMutatingTracking } =
    useSetFunctionTrackingMutation();
  const { mutateAsync: setTableTracking, isPending: isTableTrackingPending } =
    useSetTableTrackingMutation();

  const isPending = isMutatingTracking || isTableTrackingPending;

  const handleTrack = async () => {
    const shouldTrackTable = isReturnTableUntracked;

    const loadingMessage = shouldTrackTable
      ? 'Tracking table and function...'
      : 'Tracking function...';
    const successMessage = shouldTrackTable
      ? 'Table and function tracked successfully.'
      : 'Function tracked successfully.';
    const errorMessage = shouldTrackTable
      ? 'Failed to track table and function.'
      : 'Failed to track function.';

    await execPromiseWithErrorToast(
      async () => {
        if (shouldTrackTable) {
          await setTableTracking({
            tracked: true,
            resourceVersion,
            args: {
              source: dataSource,
              table: {
                name: returnTableName!,
                schema: returnTableSchema!,
              },
            },
          });

          const freshMetadata =
            await queryClient.fetchQuery<ExportMetadataResponse>({
              queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
              staleTime: 0,
            });

          await setFunctionTracking({
            tracked: true,
            resourceVersion: freshMetadata?.resource_version,
            args: {
              source: dataSource,
              function: { name: functionName, schema },
            },
          });
        } else {
          await setFunctionTracking({
            tracked: true,
            resourceVersion,
            args: {
              source: dataSource,
              function: { name: functionName, schema },
            },
          });
        }
      },
      {
        loadingMessage,
        successMessage,
        errorMessage,
      },
    );
  };

  if (isTrackedLoading || isTracked) {
    return null;
  }

  const trackLabel = isReturnTableUntracked
    ? 'Track table and function'
    : 'Track now';

  return (
    <div className="flex items-center gap-2">
      <span className="hidden h-2 w-2 shrink-0 rounded-full bg-amber-500 sm:inline-block" />
      <span className="hidden font-medium text-amber-600 text-sm sm:inline dark:text-amber-400">
        Not tracked in GraphQL
      </span>
      <Button
        onClick={handleTrack}
        disabled={isPending}
        loading={isPending}
        size="sm"
        variant="outline"
        className="border-amber-500/30 text-amber-600 text-sm hover:bg-amber-500/10 dark:text-amber-400"
      >
        <span className="sm:hidden">Track</span>
        <span className="hidden sm:inline">{trackLabel}</span>
      </Button>
    </div>
  );
}
