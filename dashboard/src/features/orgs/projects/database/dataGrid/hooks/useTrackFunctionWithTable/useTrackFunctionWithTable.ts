import { useQueryClient } from '@tanstack/react-query';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useGetTrackedTablesSet } from '@/features/orgs/projects/database/dataGrid/hooks/useGetTrackedTablesSet';
import { useIsTrackedFunction } from '@/features/orgs/projects/database/dataGrid/hooks/useIsTrackedFunction';
import { useSetFunctionTrackingMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetFunctionTrackingMutation';
import { useSetTableTrackingMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetTableTrackingMutation';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type {
  ExportMetadataResponse,
  FunctionConfiguration,
} from '@/utils/hasura-api/generated/schemas';

export interface UseTrackFunctionWithTableOptions {
  dataSource: string;
  schema: string;
  functionName: string;
  returnTableName?: string | null;
  returnTableSchema?: string | null;
  enabled?: boolean;
}

export default function useTrackFunctionWithTable({
  dataSource,
  schema,
  functionName,
  returnTableName,
  returnTableSchema,
  enabled,
}: UseTrackFunctionWithTableOptions) {
  const { project } = useProject();
  const queryClient = useQueryClient();

  const { data: isTracked, isLoading: isTrackedLoading } = useIsTrackedFunction(
    {
      dataSource,
      schema,
      functionName,
      enabled,
    },
  );

  const { data: trackedTablesSet } = useGetTrackedTablesSet({ dataSource });

  const isReturnTableUntracked =
    !!returnTableName &&
    !!returnTableSchema &&
    !trackedTablesSet?.has(`${returnTableSchema}.${returnTableName}`);

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { mutateAsync: setFunctionTracking, isPending: isFunctionPending } =
    useSetFunctionTrackingMutation();

  const { mutateAsync: setTableTracking, isPending: isTablePending } =
    useSetTableTrackingMutation();

  const isPending = isFunctionPending || isTablePending;

  async function trackFunction(configuration?: FunctionConfiguration) {
    const shouldTrackTable = isReturnTableUntracked;

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
          ...(configuration ? { configuration } : {}),
        },
      });
    } else {
      await setFunctionTracking({
        tracked: true,
        resourceVersion,
        args: {
          source: dataSource,
          function: { name: functionName, schema },
          ...(configuration ? { configuration } : {}),
        },
      });
    }
  }

  async function untrackFunction() {
    await setFunctionTracking({
      tracked: false,
      resourceVersion,
      args: {
        source: dataSource,
        function: { name: functionName, schema },
      },
    });
  }

  async function toggleTracking(configuration?: FunctionConfiguration) {
    if (isTracked) {
      await untrackFunction();
    } else {
      await trackFunction(configuration);
    }
  }

  return {
    isTracked,
    isTrackedLoading,
    isReturnTableUntracked,
    isPending,
    trackFunction,
    untrackFunction,
    toggleTracking,
  };
}
