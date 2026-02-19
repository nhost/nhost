import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useCallback } from 'react';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import useGetTrackedTablesNames from '@/features/orgs/projects/common/hooks/useGetTrackedTablesNames/useGetTrackedTablesNames';
import { useTrackTableMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useTrackTableMutation';
import type { DatabaseTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { triggerToast } from '@/utils/toast';

export default function TrackTableButton() {
  const queryClient = useQueryClient();
  const { query } = useRouter();
  const { dataSourceSlug, tableSlug } = query;
  const { project } = useProject();

  const { data: trackedTableNames } = useGetTrackedTablesNames({
    dataSource: dataSourceSlug as string,
    queryOptions: { enabled: typeof dataSourceSlug === 'string' },
  });

  const isTracked =
    typeof tableSlug === 'string'
      ? new Set(trackedTableNames ?? []).has(tableSlug)
      : undefined;

  const { mutateAsync: trackTable, status } = useTrackTableMutation();

  const handleTrack = useCallback(async () => {
    try {
      await trackTable({
        table: { name: tableSlug as string } as DatabaseTable,
      });
      triggerToast('Table tracked successfully.');
      await queryClient.invalidateQueries({
        queryKey: ['export-metadata', project?.subdomain],
      });
    } catch (error) {
      triggerToast(
        error instanceof Error ? error.message : 'Failed to track table.',
      );
    }
  }, [trackTable, tableSlug, queryClient, project?.subdomain]);

  if (isTracked !== false) {
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
        disabled={status === 'loading'}
        loading={status === 'loading'}
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
