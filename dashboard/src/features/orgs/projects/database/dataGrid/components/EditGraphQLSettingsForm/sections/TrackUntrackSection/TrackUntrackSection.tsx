import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import useGetMetadataResourceVersion from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion/useGetMetadataResourceVersion';
import { useIsTrackedTable } from '@/features/orgs/projects/common/hooks/useIsTrackedTable';
import { useTrackTableMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackTableMutation';
import { useUntrackTableMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useUntrackTableMutation';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
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
  const queryClient = useQueryClient();
  const { project } = useProject();
  const { query } = useRouter();
  const { dataSourceSlug } = query;

  const { data: isTracked } = useIsTrackedTable({
    dataSource: dataSourceSlug as string,
    schema,
    tableName,
  });

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { mutateAsync: trackTable, status: trackStatus } =
    useTrackTableMutation();
  const { mutateAsync: untrackTable, status: untrackStatus } =
    useUntrackTableMutation();

  const isPending = trackStatus === 'loading' || untrackStatus === 'loading';

  async function handleTrackToggle() {
    const action = isTracked ? 'untrack' : 'track';

    await execPromiseWithErrorToast(
      async () => {
        if (isTracked) {
          await untrackTable({
            args: {
              source: dataSourceSlug as string,
              table: { name: tableName, schema },
            },
          });
        } else {
          await trackTable({
            resourceVersion: resourceVersion,
            args: {
              source: dataSourceSlug as string,
              table: { name: tableName, schema },
            },
          });
        }
        await queryClient.invalidateQueries({
          queryKey: ['export-metadata', project?.subdomain],
        });
      },
      {
        loadingMessage: `${isTracked ? 'Untracking' : 'Tracking'} table...`,
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
