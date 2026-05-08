import { format, subMinutes } from 'date-fns';
import { useMemo } from 'react';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { useProjectLogs } from '@/features/orgs/projects/hooks/useProjectLogs';
import { CoreLogService } from '@/features/orgs/projects/logs/utils/constants/services';
import type { WidgetConfig } from '@/features/orgs/projects/overview/dashboard/types';
import { cn } from '@/lib/utils';

type LogsWidgetProps = {
  cfg: WidgetConfig;
};

function severityFromLog(log: string): 'info' | 'warn' | 'error' {
  const lower = log.toLowerCase();
  if (
    lower.includes('error') ||
    lower.includes('failed') ||
    lower.includes('panic') ||
    lower.includes('fatal')
  ) {
    return 'error';
  }
  if (lower.includes('warn')) {
    return 'warn';
  }
  return 'info';
}

const SEVERITY_COLOR: Record<'info' | 'warn' | 'error', string> = {
  info: 'bg-sky-500',
  warn: 'bg-amber-400',
  error: 'bg-red-500',
};

export default function LogsWidget({ cfg }: LogsWidgetProps) {
  const limit = cfg.count ?? 7;
  const filters = useMemo(
    () => ({
      from: subMinutes(new Date(), 60).toISOString(),
      to: null,
      service: CoreLogService.ALL,
      regexFilter: '',
    }),
    [],
  );

  const { data, loading } = useProjectLogs(filters);

  const logs = useMemo(() => {
    const all = data?.logs ?? [];
    return [...all]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);
  }, [data, limit]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-row place-content-between items-center gap-2 pb-4">
        <Text variant="h3" className="font-medium">
          Recent logs
        </Text>
      </div>

      {loading && !logs.length ? (
        <Box className="rounded-lg p-4" sx={{ backgroundColor: 'grey.200' }}>
          <ActivityIndicator label="Loading logs..." />
        </Box>
      ) : !logs.length ? (
        <Box
          className="rounded-lg p-4 text-center"
          sx={{ backgroundColor: 'grey.200' }}
        >
          <Text variant="subtitle1" color="secondary">
            No recent logs.
          </Text>
        </Box>
      ) : (
        <Box
          className="overflow-hidden rounded-lg"
          sx={{ backgroundColor: 'grey.200' }}
        >
          <ul className="divide-y divide-divider">
            {logs.map((log) => {
              const ts = new Date(log.timestamp);
              const severity = severityFromLog(log.log);
              return (
                <li
                  key={`${log.timestamp}-${log.service}-${log.log.slice(0, 30)}`}
                  className="flex items-center gap-2.5 px-3 py-2"
                >
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-sm',
                      SEVERITY_COLOR[severity],
                    )}
                    role="img"
                    aria-label={severity}
                  />
                  <Text
                    variant="body2"
                    color="secondary"
                    className="shrink-0 font-mono text-xs"
                  >
                    {format(ts, 'HH:mm:ss')}
                  </Text>
                  <Text
                    variant="body2"
                    color="secondary"
                    className="shrink-0 font-medium text-xs"
                  >
                    {log.service}
                  </Text>
                  <Text variant="body2" className="truncate font-mono text-xs">
                    {log.log}
                  </Text>
                </li>
              );
            })}
          </ul>
        </Box>
      )}
    </div>
  );
}
