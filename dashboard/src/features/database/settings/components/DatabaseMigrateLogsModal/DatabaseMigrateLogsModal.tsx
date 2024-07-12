import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useGetSystemLogsQuery } from '@/utils/__generated__/graphql';
import { useVisibilityChange } from '@uidotdev/usehooks';

export interface DatabaseMigrateLogsModalProps {
  fromFilter?: Date;
}

interface Log {
  level: string;
  msg: string;
  time: string;
}

export default function DatabaseMigrateLogsModal({
  fromFilter,
}: DatabaseMigrateLogsModalProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const isVisible = useVisibilityChange();

  const { data } = useGetSystemLogsQuery({
    variables: {
      appID: currentProject.id,
      action: 'change-database-version',
      from: fromFilter,
    },
    skipPollAttempt: () => !isVisible,
    pollInterval: 5000,
  });

  const logs = data?.systemLogs ?? [];

  return (
    <Box className="pt-2">
      <Box
        className="min-h-80 p-4"
        sx={{
          backgroundColor: 'grey.700',
        }}
      >
        {logs.map(({ log }) => {
          let logObj: Partial<Log> = {};
          try {
            logObj = JSON.parse(log);
          } catch (e) {
            console.error('Failed to parse log', log);
            return undefined;
          }
          if (logObj?.level && logObj?.msg) {
            return (
              <Text
                key={`${logObj.msg}${logObj.time}`}
                className="font-mono"
                sx={{
                  color: 'grey.100',
                }}
              >
                {logObj.level.toUpperCase()}: {logObj.msg}
              </Text>
            );
          }

          return undefined;
        })}
      </Box>
    </Box>
  );
}
