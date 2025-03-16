import { Text } from '@/components/ui/v2/Text';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetricsCardProps } from '@/features/orgs/projects/overview/components/MetricsCard';
import { MetricsCard } from '@/features/orgs/projects/overview/components/MetricsCard';
import {
  useGetProjectMetricsQuery,
  useGetProjectRequestsMetricQuery,
  useGetUserProjectMetricsQuery,
} from '@/utils/__generated__/graphql';
import { prettifyNumber } from '@/utils/prettifyNumber';
import { twMerge } from 'tailwind-merge';

import { prettifySize } from '@/utils/prettifySize';
import { formatISO, startOfDay, startOfMonth, subMinutes } from 'date-fns';

const now = new Date();

export default function OverviewMetrics() {
  const { project } = useProject();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();

  const {
    data: {
      allUsers: { aggregate: { count: allUsers = 0 } = {} } = {},
      dailyActiveUsers: {
        aggregate: { count: dailyActiveUsers = 0 } = {},
      } = {},
      monthlyActiveUsers: {
        aggregate: { count: monthlyActiveUsers = 0 } = {},
      } = {},
      filesAggregate: {
        aggregate: { sum: { size: totalStorage = 0 } = {} } = {},
      } = {},
    } = {},
  } = useGetUserProjectMetricsQuery({
    client: remoteProjectGQLClient,
    variables: {
      startOfMonth: startOfMonth(new Date()),
      today: startOfDay(new Date()),
    },
    skip: !project,
  });

  const {
    data: {
      totalRequests: { value: totalRequestsInLastFiveMinutes = 0 } = {},
    } = {},
  } = useGetProjectRequestsMetricQuery({
    variables: {
      appId: project.id,
      from: formatISO(subMinutes(new Date(), 6)), // 6 mns earlier
      to: formatISO(subMinutes(new Date(), 1)), // 1 mn earlier
    },
    skip: !project,
    pollInterval: 1000 * 60 * 5, // Poll every 5 minutes
  });

  const {
    data: {
      functionsDuration: { value: functionsDuration = 0 } = {},
      totalRequests: { value: totalRequests = 0 } = {},
      postgresVolumeUsage: { value: postgresVolumeUsage = 0 } = {},
      egressVolume: { value: egressVolume = 0 } = {},
    } = {},
    loading,
    error,
  } = useGetProjectMetricsQuery({
    variables: {
      appId: project.id,
      subdomain: project?.subdomain,
      from: new Date(now.getFullYear(), now.getMonth(), 1),
    },
    skip: !project,
  });

  const cardElements: MetricsCardProps[] = [
    {
      label: 'Daily Active Users',
      tooltip: 'Unique users active today',
      value: prettifyNumber(dailyActiveUsers),
    },
    {
      label: 'Monthly Active Users',
      tooltip: 'Unique users active this month',
      value: prettifyNumber(monthlyActiveUsers),
    },
    {
      label: 'All Users',
      tooltip: 'Total registered users',
      value: prettifyNumber(allUsers),
    },
    {
      label: 'RPS',
      tooltip: 'Requests Per Second (RPS) measured in the last 5 minutes',
      value: prettifyNumber(totalRequestsInLastFiveMinutes / 300, {
        numberOfDecimals: 2,
      }),
    },
    {
      label: 'Total Requests',
      tooltip: 'Total service requests this month so far (excluding functions)',
      value: prettifyNumber(totalRequests || 0, {
        numberOfDecimals: totalRequests > 1000 ? 2 : 0,
      }),
    },
    {
      label: 'Egress',
      tooltip: 'Total outgoing data transfer this month so far',
      value: prettifySize(egressVolume),
    },
    {
      label: 'Functions Duration',
      tooltip: 'Total Functions execution this month so far',
      value: prettifyNumber(functionsDuration),
    },
    {
      label: 'Storage',
      tooltip: 'Total size of stored files in the storage service',
      value: prettifySize(totalStorage || 0),
    },
    {
      label: 'Postgres Volume Usage',
      tooltip: 'Used storage in the Postgres database',
      value: prettifySize(postgresVolumeUsage),
    },
  ];

  if (error) {
    throw error;
  }

  return (
    <div className="grid grid-flow-row gap-4">
      <div className="grid grid-cols-1 justify-start gap-4 xs:grid-cols-2 md:grid-cols-3">
        {cardElements.map(({ label, value, tooltip, className, ...props }) => (
          <MetricsCard
            {...props}
            key={label}
            label={!loading ? label : null}
            value={!loading ? value : null}
            tooltip={!loading ? tooltip : null}
            className={twMerge(
              'min-h-[92px]',
              loading && 'animate-pulse',
              className,
            )}
          />
        ))}
      </div>

      <Text color="disabled">
        Your resource usage since the beginning of the month.
      </Text>
    </div>
  );
}
