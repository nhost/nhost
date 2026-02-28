import { subMinutes } from 'date-fns';
import { type ReactElement, useCallback, useState } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { useProjectLogs } from '@/features/orgs/projects/hooks/useProjectLogs';
import { LogsBody } from '@/features/orgs/projects/logs/components/LogsBody';
import {
  type LogsFilterFormValues,
  LogsHeader,
} from '@/features/orgs/projects/logs/components/LogsHeader';
import { CoreLogService } from '@/features/orgs/projects/logs/utils/constants/services';
import { DEFAULT_LOG_INTERVAL } from '@/utils/constants/common';

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
    [],
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
