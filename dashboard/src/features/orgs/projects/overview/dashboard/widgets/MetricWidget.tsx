import { formatISO, startOfDay, startOfMonth, subMinutes } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { MetricsCard } from '@/features/orgs/projects/overview/components/MetricsCard';
import type {
  MetricKind,
  WidgetConfig,
} from '@/features/orgs/projects/overview/dashboard/types';
import {
  useGetProjectMetricsQuery,
  useGetProjectRequestsMetricQuery,
  useGetUserProjectMetricsQuery,
} from '@/utils/__generated__/graphql';
import { prettifyNumber } from '@/utils/prettifyNumber';
import { prettifySize } from '@/utils/prettifySize';

const METRIC_LABELS: Record<MetricKind, { label: string; tooltip: string }> = {
  rps: {
    label: 'RPS',
    tooltip: 'Requests Per Second (RPS) measured in the last 5 minutes',
  },
  dau: { label: 'Daily Active Users', tooltip: 'Unique users active today' },
  mau: {
    label: 'Monthly Active Users',
    tooltip: 'Unique users active this month',
  },
  allUsers: { label: 'All Users', tooltip: 'Total registered users' },
  reqs: {
    label: 'Total Requests',
    tooltip: 'Total service requests this month so far (excluding functions)',
  },
  egress: {
    label: 'Egress',
    tooltip: 'Total outgoing data transfer this month so far',
  },
  fns: {
    label: 'Functions Duration',
    tooltip: 'Total Functions execution this month so far',
  },
  storage: {
    label: 'Storage',
    tooltip: 'Total size of stored files in the storage service',
  },
  pgvol: {
    label: 'Postgres Volume Usage',
    tooltip: 'Used storage in the Postgres database',
  },
};

type MetricWidgetProps = {
  cfg: WidgetConfig;
};

export default function MetricWidget({ cfg }: MetricWidgetProps) {
  const { project } = useProject();
  const remoteClient = useRemoteApplicationGQLClient();
  const kind: MetricKind = (cfg.metric as MetricKind) ?? 'rps';
  const { label, tooltip } = METRIC_LABELS[kind];

  const usesUserMetrics = ['dau', 'mau', 'allUsers', 'storage'].includes(kind);
  const usesProjectMetrics = ['reqs', 'egress', 'fns', 'pgvol'].includes(kind);

  const { data: userMetricsData, loading: loadingUser } =
    useGetUserProjectMetricsQuery({
      client: remoteClient,
      variables: {
        startOfMonth: startOfMonth(new Date()),
        today: startOfDay(new Date()),
      },
      skip: !project || !usesUserMetrics,
    });

  const { data: rpsData, loading: loadingRps } =
    useGetProjectRequestsMetricQuery({
      variables: {
        appId: project?.id,
        from: formatISO(subMinutes(new Date(), 6)),
        to: formatISO(subMinutes(new Date(), 1)),
      },
      skip: !project || kind !== 'rps',
      pollInterval: 1000 * 60 * 5,
    });

  const { data: projectMetricsData, loading: loadingProject } =
    useGetProjectMetricsQuery({
      variables: {
        appId: project?.id,
        subdomain: project?.subdomain ?? '',
        from: startOfMonth(new Date()),
      },
      skip: !project || !usesProjectMetrics,
    });

  const loading =
    (kind === 'rps' && loadingRps) ||
    (usesUserMetrics && loadingUser) ||
    (usesProjectMetrics && loadingProject);

  let value = '—';
  switch (kind) {
    case 'rps': {
      const v = rpsData?.totalRequests?.value ?? 0;
      value = prettifyNumber(v / 300, { numberOfDecimals: 2 });
      break;
    }
    case 'dau':
      value = prettifyNumber(
        userMetricsData?.dailyActiveUsers?.aggregate?.count ?? 0,
      );
      break;
    case 'mau':
      value = prettifyNumber(
        userMetricsData?.monthlyActiveUsers?.aggregate?.count ?? 0,
      );
      break;
    case 'allUsers':
      value = prettifyNumber(userMetricsData?.allUsers?.aggregate?.count ?? 0);
      break;
    case 'reqs': {
      const total = projectMetricsData?.totalRequests?.value ?? 0;
      value = prettifyNumber(total, {
        numberOfDecimals: total > 1000 ? 2 : 0,
      });
      break;
    }
    case 'egress':
      value = prettifySize(projectMetricsData?.egressVolume?.value ?? 0);
      break;
    case 'fns':
      value = prettifyNumber(projectMetricsData?.functionsDuration?.value ?? 0);
      break;
    case 'storage':
      value = prettifySize(
        userMetricsData?.filesAggregate?.aggregate?.sum?.size ?? 0,
      );
      break;
    case 'pgvol':
      value = prettifySize(projectMetricsData?.postgresVolumeUsage?.value ?? 0);
      break;
    default:
      value = '—';
  }

  return (
    <MetricsCard
      label={!loading ? label : null}
      value={!loading ? value : null}
      tooltip={!loading ? tooltip : null}
      className={twMerge('h-full min-h-[92px]', loading && 'animate-pulse')}
    />
  );
}
