import { useRouter } from 'next/router';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { useTrackFunctionWithTable } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackFunctionWithTable';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

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

  const {
    isTracked,
    isTrackedLoading,
    isReturnTableUntracked,
    isPending,
    trackFunction,
  } = useTrackFunctionWithTable({
    dataSource,
    schema,
    functionName,
    returnTableName,
    returnTableSchema,
    enabled: typeof dataSourceSlug === 'string' && !!schema && !!functionName,
  });

  const handleTrack = async () => {
    const shouldTrackTable = isReturnTableUntracked;

    await execPromiseWithErrorToast(() => trackFunction(), {
      loadingMessage: shouldTrackTable
        ? 'Tracking table and function...'
        : 'Tracking function...',
      successMessage: shouldTrackTable
        ? 'Table and function tracked successfully.'
        : 'Function tracked successfully.',
      errorMessage: shouldTrackTable
        ? 'Failed to track table and function.'
        : 'Failed to track function.',
    });
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
