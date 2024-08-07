import { Text } from '@/components/ui/v2/Text';
import { useMigrationLogs } from '@/features/database/common/hooks/useMigrationLogs';

export default function DatabaseMigrateLogsModalText() {
  const { logs, loading, error } = useMigrationLogs();

  if (error) {
    return (
      <Text
        className="font-mono"
        sx={{
          color: (theme) =>
            theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
        }}
      >
        Could not fetch logs. Error: {error.message}
      </Text>
    );
  }

  if (loading) {
    return (
      <Text
        className="font-mono"
        sx={{
          color: (theme) =>
            theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
        }}
      >
        Loading...
      </Text>
    );
  }

  if (logs.length === 0) {
    return (
      <Text
        className="font-mono"
        sx={{
          color: (theme) =>
            theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
        }}
      >
        No logs found
      </Text>
    );
  }

  return (
    <>
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
    </>
  );
}
