import { Box } from '@/components/ui/v2/Box';
import { DatabaseMigrateLogsModalText } from '@/features/database/settings/components/DatabaseMigrateLogsModalText';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useGetSystemLogsQuery } from '@/utils/__generated__/graphql';
import { useVisibilityChange } from '@uidotdev/usehooks';

export interface DatabaseMigrateLogsModalProps {
  fromFilter: Date;
}

export default function DatabaseMigrateLogsModal({
  fromFilter,
}: DatabaseMigrateLogsModalProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const isVisible = useVisibilityChange();

  const { data, loading, error } = useGetSystemLogsQuery({
    variables: {
      appID: currentProject.id,
      action: 'change-database-version',
      from: fromFilter,
    },
    skipPollAttempt: () => !isVisible,
    pollInterval: 5000,
  });

  const logs = data?.systemLogs ?? [];
  const sortedLogs = [...logs];
  sortedLogs.sort(
    (a, b) => new Date(a.timestamp).valueOf() - new Date(b.timestamp).valueOf(),
  ); // sort in ascending order

  return (
    <Box className="pt-2">
      <Box
        className="min-h-80 p-4"
        sx={{
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? 'grey.300' : 'grey.700',
        }}
      >
        <DatabaseMigrateLogsModalText
          logs={sortedLogs}
          loading={loading}
          error={error}
        />
      </Box>
    </Box>
  );
}
