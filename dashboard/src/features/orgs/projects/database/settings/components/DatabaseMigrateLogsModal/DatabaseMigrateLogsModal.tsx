import { useMigrationLogs } from '@/features/orgs/projects/database/common/hooks/useMigrationLogs';

export default function DatabaseMigrateLogsModal() {
  const { logs, loading, error } = useMigrationLogs({
    shouldPoll: true,
  });

  if (error) {
    return (
      <div className="pt-2">
        <div className="min-h-80 bg-[#21324b] p-4 dark:bg-[#2f363d]">
          <p className="font-mono text-white">
            Could not fetch logs. Error: {error.message}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pt-2">
        <div className="min-h-80 bg-[#21324b] p-4 dark:bg-[#2f363d]">
          <p className="font-mono text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="pt-2">
        <div className="min-h-80 bg-[#21324b] p-4 dark:bg-[#2f363d]">
          <p className="font-mono text-white">No logs found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2">
      <div className="min-h-80 bg-[#21324b] p-4 dark:bg-[#2f363d]">
        {logs.map((logObj) => {
          if (logObj?.level && logObj?.msg) {
            return (
              <p
                key={`${logObj.msg}${logObj.time}`}
                className="font-mono text-white"
              >
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
