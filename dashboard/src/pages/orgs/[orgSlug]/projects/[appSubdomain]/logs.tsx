import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useProjectLogs } from '@/features/orgs/projects/hooks/useProjectLogs';
import { LogsBody } from '@/features/orgs/projects/logs/components/LogsBody';
import {
  LogsHeader,
  type LogsFilterFormValues,
} from '@/features/orgs/projects/logs/components/LogsHeader';
import { AvailableLogsService } from '@/features/orgs/projects/logs/utils/constants/services';
import { DEFAULT_LOG_INTERVAL } from '@/utils/constants/common';
import { subMinutes } from 'date-fns';
import { useCallback, useState, type ReactElement } from 'react';

interface LogsFilters {
  from: string;
  to: string | null;
  service: AvailableLogsService;
  regexFilter: string;
}

export default function LogsPage() {
  const [filters, setFilters] = useState<LogsFilters>(() => ({
    from: subMinutes(new Date(), DEFAULT_LOG_INTERVAL).toISOString(),
    to: new Date().toISOString(),
    regexFilter: '',
    service: AvailableLogsService.ALL,
  }));

  const { data, error, loading, refetch } = useProjectLogs(filters);

  const onSubmitFilterValues = useCallback(
    async (values: LogsFilterFormValues) => {
      setFilters({ ...(values as LogsFilters) });
    },
    [setFilters],
  );

  return (
    <div className="flex h-full w-full flex-col">
      <RetryableErrorBoundary>
        <LogsHeader
          loading={loading}
          onSubmitFilterValues={onSubmitFilterValues}
          onRefetch={refetch}
        />
        <LogsBody error={error} loading={loading} logsData={data} />
      </RetryableErrorBoundary>
    </div>
  );
}

LogsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
