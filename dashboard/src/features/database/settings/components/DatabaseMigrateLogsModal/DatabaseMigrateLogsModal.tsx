import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useGetSystemLogsQuery } from '@/utils/__generated__/graphql';

export interface DatabaseMigrateLogsModalProps {
  fromFilter?: Date;
}

export default function DatabaseMigrateLogsModal({
  fromFilter,
}: DatabaseMigrateLogsModalProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const { data } = useGetSystemLogsQuery({
    variables: {
      appID: currentProject.id,
      action: 'change-database-version',
      from: fromFilter,
    },
  });

  const logs = [{ log: 'INFO: No logs found' }, { log: 'INFO: No logs found' }];

  return (
    <Box
      className="min-h-80 p-4"
      sx={{
        backgroundColor: 'grey.700',
      }}
    >
      {logs.map((log) => (
        <Text
          className="font-mono"
          sx={{
            color: 'grey.100',
          }}
        >
          {log.log}
        </Text>
      ))}
    </Box>
  );
}
