import { Text } from '@/components/ui/v2/Text';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetricsCardProps } from '@/features/orgs/projects/overview/components/MetricsCard';
import { MetricsCard } from '@/features/orgs/projects/overview/components/MetricsCard';
import { prettifyNumber } from '@/utils/prettifyNumber';
import {
  useGetProjectMetricsQuery,
  useGetUserProjectMetricsQuery,
} from '@/utils/__generated__/graphql';
import { twMerge } from 'tailwind-merge';

import { prettifySize } from '@/utils/prettifySize';
import { startOfDay, startOfMonth } from 'date-fns';

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
      functionInvocations: { value: functionInvocations = 0 } = {},
      functionsDuration: { value: functionsDuration = 0 } = {},
      totalRequests: { value: totalRequests = 0 } = {},
      postgresVolumeUsage: { value: postgresVolumeUsage = 0 } = {},
      egressVolume: { value: egressVolume = 0 } = {},
      cpuSecondsUsage: { value: cpuSecondsUsage = 0 } = {},
    } = {},
    loading,
    error,
  } = useGetProjectMetricsQuery({
    variables: {
      appId: project?.id,
      subdomain: project?.subdomain,
      from: new Date(now.getFullYear(), now.getMonth(), 1),
    },
    skip: !project,
  });

  const cardElements: MetricsCardProps[] = [
    {
      label: 'Monthly Active Users',
      tooltip: 'Unique users active this month',
      value: prettifyNumber(monthlyActiveUsers),
    },
    {
      label: 'Daily Active Users',
      tooltip: 'Unique users active today',
      value: prettifyNumber(dailyActiveUsers),
    },
    {
      label: 'All Users',
      tooltip: 'Total unique users',
      value: prettifyNumber(allUsers),
    },
    {
      label: 'Storage',
      tooltip: 'Total size of stored files in the storage service',
      value: prettifySize(totalStorage || 0),
    },
    {
      label: 'Total Requests',
      tooltip: 'Total service requests (excluding functions)',
      value: prettifyNumber(totalRequests || 0, {
        numberOfDecimals: totalRequests > 1000 ? 2 : 0,
      }),
    },
    {
      label: 'Function Invocations',
      tooltip: 'Total function calls',
      value: prettifyNumber(functionInvocations || 0, {
        numberOfDecimals: 0,
      }),
    },
    {
      label: 'Function Duration',
      tooltip: 'Total function execution time this month',
      value: prettifyNumber(functionsDuration),
    },
    {
      label: 'Postgres Volume Usage',
      tooltip: 'Used storage in the Postgres database',
      value: prettifySize(postgresVolumeUsage),
    },
    {
      label: 'Egress',
      tooltip: 'Total outgoing data transfer',
      value: prettifySize(egressVolume),
    },
    {
      label: 'RPS',
      tooltip:
        'Requests per second, calculated as total requests divided by CPU seconds usage',
      value: prettifyNumber(totalRequests / cpuSecondsUsage, {
        numberOfDecimals: 2,
      }),
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
