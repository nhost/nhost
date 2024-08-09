import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { useMigrationLogs } from '@/features/database/common/hooks/useMigrationLogs';

export default function DatabaseMigrateLogsModal() {
  const { logs, loading, error } = useMigrationLogs({
    shouldPoll: true,
  });

  if (error) {
    return (
      <Box className="pt-2">
        <Box
          className="min-h-80 p-4"
          sx={{
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.300' : 'grey.700',
          }}
        >
          <Text
            className="font-mono"
            sx={{
              color: (theme) =>
                theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
            }}
          >
            Could not fetch logs. Error: {error.message}
          </Text>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box className="pt-2">
        <Box
          className="min-h-80 p-4"
          sx={{
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.300' : 'grey.700',
          }}
        >
          <Text
            className="font-mono"
            sx={{
              color: (theme) =>
                theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
            }}
          >
            Loading...
          </Text>
        </Box>
      </Box>
    );
  }

  if (logs.length === 0) {
    return (
      <Box className="pt-2">
        <Box
          className="min-h-80 p-4"
          sx={{
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.300' : 'grey.700',
          }}
        >
          <Text
            className="font-mono"
            sx={{
              color: (theme) =>
                theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
            }}
          >
            No logs found
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box className="pt-2">
      <Box
        className="min-h-80 p-4"
        sx={{
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? 'grey.300' : 'grey.700',
        }}
      >
        {logs.map((logObj) => {
          if (logObj?.level && logObj?.msg) {
            return (
              <Text
                key={`${logObj.msg}${logObj.time}`}
                className="font-mono"
                sx={{
                  color: (theme) =>
                    theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
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
