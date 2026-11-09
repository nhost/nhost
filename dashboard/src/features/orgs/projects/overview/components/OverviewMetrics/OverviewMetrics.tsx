import { formatISO, startOfDay, startOfMonth, subMinutes } from 'date-fns';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { MetricsCardProps } from '@/features/orgs/projects/overview/components/MetricsCard';
import { MetricsCard } from '@/features/orgs/projects/overview/components/MetricsCard';
import {
  useGetProjectMetricsQuery,
  useGetProjectRequestsMetricQuery,
  useGetUserProjectMetricsQuery,
} from '@/generated/graphql';
import { cn } from '@/lib/utils';
import { prettifyNumber } from '@/utils/prettifyNumber';
import { prettifySize } from '@/utils/prettifySize';

const now = new Date();

export default function OverviewMetrics() {
  const { project } = useProject();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();

  const { data } = useGetUserProjectMetricsQuery({
    client: remoteProjectGQLClient,
    variables: {
      startOfMonth: startOfMonth(new Date()),
      today: startOfDay(new Date()),
    },
    skip: !project,
  });

  const allUsers = data?.allUsers?.aggregate?.count ?? 0;
  const dailyActiveUsers = data?.dailyActiveUsers?.aggregate?.count ?? 0;
  const monthlyActiveUsers = data?.monthlyActiveUsers?.aggregate?.count ?? 0;
  const totalStorage = data?.filesAggregate?.aggregate?.sum?.size ?? 0;
  const totalFiles = data?.filesAggregate?.aggregate?.count ?? 0;

  const {
    data: {
      totalRequests: { value: totalRequestsInLastFiveMinutes = 0 } = {},
    } = {},
  } = useGetProjectRequestsMetricQuery({
    variables: {
      appId: project?.id,
      from: formatISO(subMinutes(new Date(), 6)),
      to: formatISO(subMinutes(new Date(), 1)),
    },
    skip: !project,
    pollInterval: 1000 * 60 * 5,
  });

  const {
    data: {
      functionInvocations: { value: functionInvocations = 0 } = {},
      totalRequests: { value: totalRequests = 0 } = {},
      postgresVolumeUsage: { value: postgresVolumeUsage = 0 } = {},
      postgresVolumeCapacity: { value: postgresVolumeCapacity = 0 } = {},
      egressVolume: { value: egressVolume = 0 } = {},
    } = {},
    loading,
    error,
  } = useGetProjectMetricsQuery({
    variables: {
      appId: project?.id,
      subdomain: project!.subdomain!,
      from: new Date(now.getFullYear(), now.getMonth(), 1),
    },
    skip: !project,
  });

  const requestsPerSecond = totalRequestsInLastFiveMinutes / 300;

  const cardElements: MetricsCardProps[] = [
    {
      label: 'Users',
      tooltip: 'Total registered users',
      value: prettifyNumber(allUsers),
      detail: `${prettifyNumber(dailyActiveUsers)} active today · ${prettifyNumber(monthlyActiveUsers)} this month`,
    },
    {
      label: 'Requests',
      tooltip: 'Total service requests this month so far (excluding functions)',
      value: prettifyNumber(totalRequests || 0, {
        numberOfDecimals: totalRequests > 1000 ? 2 : 0,
      }),
      detail: `About ${prettifyNumber(requestsPerSecond, {
        numberOfDecimals: requestsPerSecond < 10 ? 2 : 0,
      })} per second right now`,
    },
    {
      label: 'Egress',
      tooltip: 'Total outgoing data transfer this month so far',
      value: prettifySize(egressVolume),
    },
    {
      label: 'Functions',
      tooltip: 'Function invocations this month so far',
      value: prettifyNumber(functionInvocations),
      detail: 'Invocations',
    },
    {
      label: 'Storage',
      tooltip: 'Total size of stored files in the storage service',
      value: prettifySize(totalStorage || 0),
      detail: `${prettifyNumber(totalFiles)} ${totalFiles === 1 ? 'file' : 'files'}`,
    },
    {
      label: 'Postgres volume',
      tooltip: 'Used storage in the Postgres database',
      value: prettifySize(postgresVolumeUsage),
      usage:
        postgresVolumeCapacity > 0
          ? {
              percent: (postgresVolumeUsage / postgresVolumeCapacity) * 100,
              limitLabel: prettifySize(postgresVolumeCapacity),
            }
          : null,
    },
  ];

  if (error) {
    throw error;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold text-lg">Usage this month</h2>
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shadow-sm md:grid-cols-3">
        {cardElements.map(({ label, value, tooltip, className, ...props }) => (
          <MetricsCard
            {...props}
            key={label}
            label={!loading ? label : null}
            value={!loading ? value : null}
            tooltip={!loading ? tooltip : null}
            className={cn('min-h-24', loading && 'animate-pulse', className)}
          />
        ))}
      </div>
    </section>
  );
}
