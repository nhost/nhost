import { useRouter } from 'next/router';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useIsTrackedFunction } from '@/features/orgs/projects/database/dataGrid/hooks/useIsTrackedFunction';
import { useSetFunctionTrackingMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetFunctionTrackingMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

export interface TrackFunctionButtonProps {
  schema: string;
  functionName: string;
}

export default function TrackFunctionButton({
  schema,
  functionName,
}: TrackFunctionButtonProps) {
  const { query } = useRouter();
  const { dataSourceSlug } = query;
  const dataSource = (dataSourceSlug as string) || 'default';

  const { data: isTracked, isLoading: isTrackedLoading } = useIsTrackedFunction(
    {
      dataSource,
      schema,
      functionName,
      enabled: typeof dataSourceSlug === 'string' && !!schema && !!functionName,
    },
  );

  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const { mutateAsync: setFunctionTracking, isPending: isMutatingTracking } =
    useSetFunctionTrackingMutation();

  const handleTrack = async () => {
    await execPromiseWithErrorToast(
      async () => {
        await setFunctionTracking({
          tracked: true,
          resourceVersion,
          args: {
            source: dataSource,
            function: {
              name: functionName,
              schema,
            },
          },
        });
      },
      {
        successMessage: 'Function tracked successfully.',
        loadingMessage: 'Tracking function...',
        errorMessage: 'Failed to track function.',
      },
    );
  };

  if (isTrackedLoading || isTracked) {
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
