import { useRouter } from 'next/router';
import { useState } from 'react';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { ConfirmTrackAsQueryDialog } from '@/features/orgs/projects/database/dataGrid/components/ConfirmTrackAsQueryDialog';
import { useTrackFunctionWithTableToast } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackFunctionWithTable';

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
    trackFunctionWithToast,
  } = useTrackFunctionWithTableToast({
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
    await trackFunctionWithToast({ exposed_as: 'mutation' });
  };

  const handleTrackAsQuery = async () => {
    await trackFunctionWithToast({ exposed_as: 'query' });
  };

  const handleConfirmTrackAsQuery = async () => {
    await trackFunctionWithToast({ exposed_as: 'query' });
    setShowConfirmDialog(false);
  };

  if (isTrackedLoading || isTracked) {
    return null;
  }

  const isVolatile = functionType === 'VOLATILE';

  return (
    <>
      <div className="flex flex-col gap-2 lg:flex-row">
        <div className="flex flex-row items-center gap-1">
          <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
          <span className="font-medium text-amber-600 text-sm dark:text-amber-400">
            Not tracked in GraphQL
          </span>
        </div>
        {isVolatile ? (
          <div className="flex flex-col gap-2 lg:flex-row">
            <Button
              onClick={handleTrackAsMutation}
              disabled={isPending}
              loading={isPending}
              size="sm"
              variant="outline"
              className="max-w-xs border-amber-500/30 text-amber-600 text-sm hover:bg-amber-500/10 dark:text-amber-400"
            >
              {tablePrefix} as Mutation
            </Button>
            <Button
              onClick={() => setShowConfirmDialog(true)}
              disabled={isPending}
              size="sm"
              variant="outline"
              className="max-w-xs border-amber-500/30 text-amber-600 text-sm hover:bg-amber-500/10 dark:text-amber-400"
            >
              {tablePrefix} as Query
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleTrackAsQuery}
            disabled={isPending}
            loading={isPending}
            size="sm"
            variant="outline"
            className="border-amber-500/30 text-amber-600 text-sm hover:bg-amber-500/10 dark:text-amber-400"
          >
            {tablePrefix} as Query
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
