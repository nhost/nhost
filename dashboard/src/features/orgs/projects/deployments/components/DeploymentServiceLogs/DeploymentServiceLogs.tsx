import { useProjectLogs } from '@/features/orgs/projects/hooks/useProjectLogs';
import { LogsBody } from '@/features/orgs/projects/logs/components/LogsBody';
import { AvailableLogsService } from '@/features/orgs/projects/logs/utils/constants/services';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { memo, useCallback, useState } from 'react';
import DeploymentLogsHeader from './DeploymentServiceLogsHeader';

interface Props {
  from: string;
  to: string | null;
}

type DeploymentLogsFilters = {
  regexFilter?: string;
  service?: AvailableLogsService;
};

function DeploymentServiceLogs({ from, to }: Props) {
  const [filters, setFilters] = useState<DeploymentLogsFilters>({
    regexFilter: '',
    service: AvailableLogsService.ALL,
  });
  const { data, error, loading } = useProjectLogs({
    from,
    to,
    service: filters.service,
    regexFilter: filters.regexFilter,
  });

  const onSubmitFilterValues = useCallback(
    (values: DeploymentLogsFilters) => {
      setFilters({ ...values });
    },
    [setFilters],
  );

  const hasLogs = isNotEmptyValue(data?.logs);

  return (
    <>
      <DeploymentLogsHeader
        onSubmit={onSubmitFilterValues}
        loading={loading}
        from={from}
        to={to}
      />
      <div className={cn({ 'h-[calc(90vh-180px)]': hasLogs }, 'pb-10')}>
        <LogsBody
          logsData={data}
          error={error}
          loading={loading}
          tableContainerClasses="bg-transparent"
        />
      </div>
    </>
  );
}

export default memo(DeploymentServiceLogs);
