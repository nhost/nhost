import { useProjectLogs } from '@/features/orgs/projects/hooks/useProjectLogs';
import { LogsBody } from '@/features/orgs/projects/logs/components/LogsBody';
import { CoreLogService } from '@/features/orgs/projects/logs/utils/constants/services';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { memo, useCallback, useState } from 'react';
import DeploymentLogsHeader, {
  type DeploymentLogsFormValues,
} from './DeploymentServiceLogsHeader';

interface Props {
  from: string;
  to: string | null;
}

function DeploymentServiceLogs({ from, to }: Props) {
  const [filters, setFilters] = useState<DeploymentLogsFormValues>({
    regexFilter: '',
    service: CoreLogService.ALL,
  });

  const { data, error, loading } = useProjectLogs({
    from,
    to,
    service: filters.service as string,
    regexFilter: filters.regexFilter,
  });

  const onSubmitFilterValues = useCallback(
    (values: DeploymentLogsFormValues) => {
      setFilters({ ...values });
    },
    [],
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
