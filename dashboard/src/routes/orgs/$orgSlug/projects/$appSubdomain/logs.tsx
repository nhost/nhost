import { createFileRoute } from '@tanstack/react-router';
import { subMinutes } from 'date-fns';
import { useCallback, useState } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import { useProjectLogs } from '@/features/orgs/projects/hooks/useProjectLogs';
import { LogsBody } from '@/features/orgs/projects/logs/components/LogsBody';
import {
  type LogsFilterFormValues,
  LogsHeader,
} from '@/features/orgs/projects/logs/components/LogsHeader';
import { CoreLogService } from '@/features/orgs/projects/logs/utils/constants/services';
import { DEFAULT_LOG_INTERVAL } from '@/utils/constants/common';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/logs',
)({
  component: RouteComponent,
});

interface LogsFilters {
  from: string;
  to: string | null;
  service: string;
  regexFilter: string;
}

function LogsPage() {
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
        <LogsBody
          filters={filters}
          error={error}
          loading={loading}
          logsData={data}
        />
      </RetryableErrorBoundary>
    </div>
  );
}

function RouteComponent() {
  return (
    <ProjectStateGate>
      <LogsPage />
    </ProjectStateGate>
  );
}
