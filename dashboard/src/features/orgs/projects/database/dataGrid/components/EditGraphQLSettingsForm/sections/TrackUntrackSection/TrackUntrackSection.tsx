import { useRouter } from 'next/router';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import useGetMetadataResourceVersion from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion/useGetMetadataResourceVersion';
import { useIsTrackedTable } from '@/features/orgs/projects/database/dataGrid/hooks/useIsTrackedTable';
import { useSetTableTrackingMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useSetTableTrackingMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

interface TrackUntrackSectionProps {
  disabled?: boolean;
  schema: string;
  tableName: string;
}

export default function TrackUntrackSection({
  disabled,
  tableName,
  schema,
}: TrackUntrackSectionProps) {
  const { query } = useRouter();
  const { dataSourceSlug } = query;

  const { data: isTracked } = useIsTrackedTable({
    dataSource: dataSourceSlug as string,
    schema,
    tableName,
  });

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { mutateAsync: setTableTracking, status } =
    useSetTableTrackingMutation();

  const isPending = status === 'loading';

  async function handleTrackToggle() {
    const tracked = !isTracked;
    const action = tracked ? 'track' : 'untrack';

    await execPromiseWithErrorToast(
      async () => {
        await setTableTracking({
          tracked,
          resourceVersion,
          args: {
            source: dataSourceSlug as string,
            table: { name: tableName, schema },
          },
        });
      },
      {
        loadingMessage: `${tracked ? 'Tracking' : 'Untracking'} table...`,
        successMessage: `Table ${action}ed successfully.`,
        errorMessage: `Failed to ${action} table.`,
      },
    );
  }

  return (
    <div className="flex items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${isTracked ? 'bg-primary' : 'bg-amber-500'}`}
        />
        <span className="font-medium text-sm">
          {isTracked ? 'Tracked in GraphQL' : 'Not tracked in GraphQL'}
        </span>
      </div>
      <ButtonWithLoading
        variant="outline"
        size="sm"
        onClick={handleTrackToggle}
        loading={isPending}
        disabled={disabled || isPending}
      >
        {isTracked ? 'Untrack' : 'Track'}
      </ButtonWithLoading>
    </div>
  );
}
