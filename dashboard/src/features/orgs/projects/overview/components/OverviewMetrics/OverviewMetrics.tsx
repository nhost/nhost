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
      functionsDuration: { value: functionsDuration = 0 } = {},
      totalRequests: { value: totalRequests = 0 } = {},
      postgresVolumeUsage: { value: postgresVolumeUsage = 0 } = {},
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

  const cardElements: MetricsCardProps[] = [
    {
      label: 'Daily active users',
      tooltip: 'Unique users active today',
      value: prettifyNumber(dailyActiveUsers),
    },
    {
      label: 'Monthly active users',
      tooltip: 'Unique users active this month',
      value: prettifyNumber(monthlyActiveUsers),
    },
    {
      label: 'All users',
      tooltip: 'Total registered users',
      value: prettifyNumber(allUsers),
    },
    {
      label: 'Requests per second',
      tooltip: 'Requests per second (RPS) measured in the last 5 minutes',
      value: prettifyNumber(totalRequestsInLastFiveMinutes / 300, {
        numberOfDecimals: 2,
      }),
    },
    {
      label: 'Total requests',
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
      label: 'Functions duration',
      tooltip: 'Total Functions execution this month so far',
      value: prettifyNumber(functionsDuration),
    },
    {
      label: 'Storage',
      tooltip: 'Total size of stored files in the storage service',
      value: prettifySize(totalStorage || 0),
    },
    {
      label: 'Postgres volume usage',
      tooltip: 'Used storage in the Postgres database',
      value: prettifySize(postgresVolumeUsage),
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
