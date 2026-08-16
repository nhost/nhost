import { subMinutes } from 'date-fns';
import { useMemo } from 'react';
import { useProjectLogs } from '@/features/orgs/projects/hooks/useProjectLogs';
import { LogsBody } from '@/features/orgs/projects/logs/components/LogsBody';
import { CoreLogService } from '@/features/orgs/projects/logs/utils/constants/services';
import type { WidgetConfig } from '@/features/orgs/projects/overview/dashboard/types';

const LOG_LOOKBACK_MINUTES = 60;

function formatLookback(minutes: number): string {
  if (minutes < 60) {
    return `Last ${minutes} minutes`;
  }
  if (minutes === 60) {
    return 'Last hour';
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 24 ? 'Last 24 hours' : `Last ${hours} hours`;
  }
  return `Last ${minutes} minutes`;
}

export default function LogsWidget(_: { cfg: WidgetConfig }) {
  const filters = useMemo(
    () => ({
      from: subMinutes(new Date(), LOG_LOOKBACK_MINUTES).toISOString(),
      to: null as string | null,
      service: CoreLogService.ALL,
      regexFilter: '',
    }),
    [],
  );
  const { data, loading, error } = useProjectLogs(filters);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-row place-content-between items-center gap-2 pb-4">
        <h3 className="font-medium text-lg">Recent logs</h3>
        <span className="text-muted-foreground text-xs">
          {formatLookback(LOG_LOOKBACK_MINUTES)}
        </span>
      </div>
      <LogsBody
        logsData={data}
        loading={loading}
        error={error}
        filters={filters}
      />
    </div>
  );
}
