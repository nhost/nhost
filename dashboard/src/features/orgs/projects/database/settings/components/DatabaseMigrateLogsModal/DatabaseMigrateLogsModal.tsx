import { useMigrationLogs } from '@/features/orgs/projects/database/common/hooks/useMigrationLogs';

export default function DatabaseMigrateLogsModal() {
  const { logs, loading, error } = useMigrationLogs({
    shouldPoll: true,
  });

  if (error) {
    return (
      <div className="pt-2">
        <div className="min-h-80 p-4">
          <p className="font-mono">
            Could not fetch logs. Error: {error.message}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pt-2">
        <div className="min-h-80 p-4">
          <p className="font-mono">Loading...</p>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="pt-2">
        <div className="min-h-80 p-4">
          <p className="font-mono">No logs found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2">
      <div className="min-h-80 p-4">
        {logs.map((logObj) => {
          if (logObj?.level && logObj?.msg) {
            return (
              <p key={`${logObj.msg}${logObj.time}`} className="font-mono">
                {logObj.level.toUpperCase()}: {logObj.msg}
              </p>
            );
          }

          return undefined;
        })}
      </div>
    </div>
  );
}
