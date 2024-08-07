import { Text } from '@/components/ui/v2/Text';
import type { GetSystemLogsQuery } from '@/utils/__generated__/graphql';
import { type ApolloError } from '@apollo/client';

interface Log {
  level: string;
  msg: string;
  time: string;
}

export default function DatabaseMigrateLogsModalText({
  logs,
  loading,
  error,
}: {
  logs: GetSystemLogsQuery['systemLogs'];
  loading: boolean;
  error: ApolloError;
}) {
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

  return logs.map(({ log }) => {
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
            color: (theme) =>
              theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
          }}
        >
          {logObj.level.toUpperCase()}: {logObj.msg}
        </Text>
      );
    }

    return undefined;
  });
}
