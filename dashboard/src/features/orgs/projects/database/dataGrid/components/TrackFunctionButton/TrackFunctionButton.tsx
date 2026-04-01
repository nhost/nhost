import { useRouter } from 'next/router';
import { useState } from 'react';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { ConfirmTrackAsQueryDialog } from '@/features/orgs/projects/database/dataGrid/components/ConfirmTrackAsQueryDialog';
import { useTrackFunctionWithTable } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackFunctionWithTable';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

export interface TrackFunctionButtonProps {
  schema: string;
  functionName: string;
  returnTableName?: string | null;
  returnTableSchema?: string | null;
  functionType?: 'IMMUTABLE' | 'STABLE' | 'VOLATILE' | null;
}

export default function TrackFunctionButton({
  schema,
  functionName,
  returnTableName,
  returnTableSchema,
  functionType,
}: TrackFunctionButtonProps) {
  const { query } = useRouter();
  const { dataSourceSlug } = query;
  const dataSource = (dataSourceSlug as string) || 'default';

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

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

  const tablePrefix = isReturnTableUntracked
    ? 'Track table and function'
    : 'Track';

  const handleTrackAsMutation = async () => {
    await execPromiseWithErrorToast(
      () => trackFunction({ exposed_as: 'mutation' }),
      {
        loadingMessage: isReturnTableUntracked
          ? 'Tracking table and function...'
          : 'Tracking function...',
        successMessage: isReturnTableUntracked
          ? 'Table and function tracked successfully.'
          : 'Function tracked successfully.',
        errorMessage: isReturnTableUntracked
          ? 'Failed to track table and function.'
          : 'Failed to track function.',
      },
    );
  };

  const handleTrackAsQuery = async () => {
    await execPromiseWithErrorToast(() => trackFunction(), {
      loadingMessage: isReturnTableUntracked
        ? 'Tracking table and function...'
        : 'Tracking function...',
      successMessage: isReturnTableUntracked
        ? 'Table and function tracked successfully.'
        : 'Function tracked successfully.',
      errorMessage: isReturnTableUntracked
        ? 'Failed to track table and function.'
        : 'Failed to track function.',
    });
    setShowConfirmDialog(false);
  };

  const handleConfirmTrackAsQuery = async () => {
    await execPromiseWithErrorToast(
      () => trackFunction({ exposed_as: 'query' }),
      {
        loadingMessage: isReturnTableUntracked
          ? 'Tracking table and function...'
          : 'Tracking function...',
        successMessage: isReturnTableUntracked
          ? 'Table and function tracked successfully.'
          : 'Function tracked successfully.',
        errorMessage: isReturnTableUntracked
          ? 'Failed to track table and function.'
          : 'Failed to track function.',
      },
    );
    setShowConfirmDialog(false);
  };

  if (isTrackedLoading || isTracked) {
    return null;
  }

  const isVolatile = functionType === 'VOLATILE';

  return (
    <>
      <div className="flex items-center gap-2">
        <span className="hidden h-2 w-2 shrink-0 rounded-full bg-amber-500 sm:inline-block" />
        <span className="hidden font-medium text-amber-600 text-sm sm:inline dark:text-amber-400">
          Not tracked in GraphQL
        </span>
        {isVolatile ? (
          <>
            <Button
              onClick={handleTrackAsMutation}
              disabled={isPending}
              loading={isPending}
              size="sm"
              variant="outline"
              className="border-amber-500/30 text-amber-600 text-sm hover:bg-amber-500/10 dark:text-amber-400"
            >
              <span className="sm:hidden">Mutation</span>
              <span className="hidden sm:inline">
                {tablePrefix} as Mutation
              </span>
            </Button>
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={isPending}
              size="sm"
              variant="ghost"
              className="text-muted-foreground text-sm hover:text-amber-600 dark:hover:text-amber-400"
            >
              <span className="sm:hidden">Query</span>
              <span className="hidden sm:inline">{tablePrefix} as Query</span>
            </Button>
          </>
        ) : (
          <Button
            onClick={handleTrackAsQuery}
            disabled={isPending}
            loading={isPending}
            size="sm"
            variant="outline"
            className="border-amber-500/30 text-amber-600 text-sm hover:bg-amber-500/10 dark:text-amber-400"
          >
            <span className="sm:hidden">Track</span>
            <span className="hidden sm:inline">{tablePrefix} as Query</span>
          </Button>
        )}
      </div>
      <ConfirmTrackAsQueryDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleConfirmTrackAsQuery}
        isPending={isPending}
      />
    </>
  );
}
