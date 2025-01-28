import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import type { MetricsCardProps } from '@/features/projects/overview/components/MetricsCard';
import { MetricsCard } from '@/features/projects/overview/components/MetricsCard';
import { useGetProjectMetricsQuery } from '@/utils/__generated__/graphql';
import { prettifyNumber } from '@/utils/prettifyNumber';
import { prettifySize } from '@/utils/prettifySize';
import { twMerge } from 'tailwind-merge';

const now = new Date();

export default function OverviewMetrics() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const { data, loading, error } = useGetProjectMetricsQuery({
    variables: {
      appId: currentProject?.id,
      subdomain: currentProject?.subdomain,
      from: new Date(now.getFullYear(), now.getMonth(), 1),
    },
    skip: !currentProject?.id,
  });

  const cardElements: MetricsCardProps[] = [
    {
      label: 'CPU Usage Seconds',
      tooltip: 'Total time the service has used the CPUs',
      value: prettifyNumber(data?.cpuSecondsUsage?.value || 0),
    },
    {
      label: 'Total Requests',
      tooltip:
        'Total amount of requests your services have received excluding functions',
      value: prettifyNumber(data?.totalRequests?.value || 0, {
        numberOfDecimals: data?.totalRequests?.value > 1000 ? 2 : 0,
      }),
    },
    {
      label: 'Function Invocations',
      tooltip: 'Number of times your functions have been called',
      value: prettifyNumber(data?.functionInvocations?.value || 0, {
        numberOfDecimals: 0,
      }),
    },
    {
      label: 'Logs',
      tooltip: 'Amount of logs stored',
      value: prettifySize(data?.logsVolume?.value || 0),
    },
  ];

  if (!data && error) {
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
