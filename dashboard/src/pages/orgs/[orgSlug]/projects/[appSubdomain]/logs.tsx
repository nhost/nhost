import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useProjectLogs } from '@/features/orgs/projects/hooks/useProjectLogs';
import { LogsBody } from '@/features/orgs/projects/logs/components/LogsBody';
import {
  LogsHeader,
  type LogsFilterFormValues,
} from '@/features/orgs/projects/logs/components/LogsHeader';
import { CoreLogService } from '@/features/orgs/projects/logs/utils/constants/services';
import { DEFAULT_LOG_INTERVAL } from '@/utils/constants/common';
import { subMinutes } from 'date-fns';
import { useCallback, useState, type ReactElement } from 'react';

interface LogsFilters {
  from: string;
  to: string | null;
  service: string;
  regexFilter: string;
}

export default function LogsPage() {
  const [filters, setFilters] = useState<LogsFilters>(() => ({
    from: subMinutes(new Date(), DEFAULT_LOG_INTERVAL).toISOString(),
    to: new Date().toISOString(),
    regexFilter: '',
    service: CoreLogService.ALL,
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
  return <OrgLayout>{page}</OrgLayout>;
};
