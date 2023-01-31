import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import {
  useGetAppFunctionsMetadataQuery,
  useGetRemoteAppMetricsQuery,
} from '@/generated/graphql';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import useDatabaseSizeOfApplication from '@/hooks/overview/useDatabaseSizeOfApplication';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import LinearProgress from '@/ui/v2/LinearProgress';
import Text from '@/ui/v2/Text';
import prettysize from 'prettysize';
import { useEffect, useState } from 'react';

export interface UsageProgressProps {
  /**
   * The title of the current service being rendered.
   */
  service: string;
  /**
   * The amount used for a given servince on the current project.
   */
  used: number;
  /**
   * The total amount of a given service.
   */
  total: number;
}

export function UsageProgress({ service, used, total }: UsageProgressProps) {
  const denotesFileSizes = service === 'Database' || service === 'Storage';
  const normalizedTotal = denotesFileSizes ? total * 1024 * 1024 : total;
  const percentage = Math.round((used / normalizedTotal) * 100);
  const prettyTotal = denotesFileSizes
    ? prettysize(total * 1024 * 1024)
    : total;
  const prettyUsed = denotesFileSizes ? prettysize(used) : used;

  return (
    <div className="flex flex-col space-y-3">
      <div className="flex flex-row place-content-between items-center">
        <Text variant="subtitle2" className="lg:!font-medium">
          {service}
        </Text>

        <Text className="text-xs !font-medium">
          {prettyUsed}{' '}
          {total && <span className="opacity-80">of {prettyTotal}</span>}
        </Text>
      </div>
      <LinearProgress
        variant="determinate"
        value={percentage === 0 ? -1 : percentage}
      />
    </div>
  );
}

const services = [
  {
    service: 'Database',
    total: { Starter: 500, Pro: 10240 },
  },
  {
    service: 'Storage',
    total: { Starter: 1024, Pro: 10240 },
  },
  {
    service: 'Users',
    total: { Starter: 10000, Pro: 100000 },
  },
  {
    service: 'Functions',
    total: { Starter: 10, Pro: 50 },
  },
];

export function OverviewUsageMetrics() {
  const isPlatform = useIsPlatform();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const remoteAppClient = useRemoteApplicationGQLClient();
  const [metrics, setMetrics] = useState({
    functions: 0,
    storage: 0,
    database: 0,
    users: 0,
  });

  const { data: functionsInfoData } = useGetAppFunctionsMetadataQuery({
    variables: { id: currentApplication?.id },
    skip: !isPlatform,
  });

  const { data: databaseSizeData } = useDatabaseSizeOfApplication(
    [currentApplication?.name, 'databaseSize'],
    { enabled: !!currentApplication },
  );

  const { data: remoteAppMetricsData } = useGetRemoteAppMetricsQuery({
    client: remoteAppClient,
  });

  useEffect(() => {
    if (databaseSizeData) {
      setMetrics((m) => ({
        ...m,
        database: databaseSizeData.databaseSize,
      }));
    }
  }, [databaseSizeData]);

  useEffect(() => {
    if (remoteAppMetricsData) {
      setMetrics((m) => ({
        ...m,
        storage: remoteAppMetricsData.filesAggregate.aggregate.sum.size,
        users: remoteAppMetricsData.usersAggregate.aggregate.count,
      }));
    }
  }, [remoteAppMetricsData]);

  useEffect(() => {
    if (functionsInfoData) {
      setMetrics((m) => ({
        ...m,
        functions: functionsInfoData.app.metadataFunctions.length,
      }));
    }
  }, [functionsInfoData]);

  return (
    <div className="grid grid-flow-row content-start gap-6">
      {services.map((service) => (
        <UsageProgress
          key={service.service}
          service={service.service}
          used={metrics[service.service.toLowerCase()]}
          total={
            isPlatform ? service.total[currentApplication.plan?.name] : null
          }
        />
      ))}
    </div>
  );
}

export default function OverviewUsage() {
  return (
    <div className="grid grid-flow-row content-start gap-6">
      <Text variant="h3">Usage</Text>
      <RetryableErrorBoundary>
        <OverviewUsageMetrics />
      </RetryableErrorBoundary>
    </div>
  );
}
