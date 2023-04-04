import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import type { BoxProps } from '@/ui/v2/Box';
import Box from '@/ui/v2/Box';
import Text from '@/ui/v2/Text';
import { useGetProjectMetricsQuery } from '@/utils/__generated__/graphql';
import { prettifySize } from '@/utils/common/prettifySize';
import { twMerge } from 'tailwind-merge';

const now = new Date();

function MetricsCard({
  label,
  value,
  className,
}: BoxProps & { label?: string; value?: string }) {
  return (
    <Box
      className={twMerge(
        'grid grid-flow-row gap-2 rounded-md px-4 py-3',
        className,
      )}
      sx={{ backgroundColor: 'grey.200' }}
    >
      {label && (
        <Text className="font-medium" color="secondary">
          {label}
        </Text>
      )}

      {value && (
        <Text variant="h2" component="p" className="truncate">
          {value}
        </Text>
      )}
    </Box>
  );
}

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

  const cardElements: { label: string; value: string }[] = [
    {
      label: 'CPU Usage Seconds',
      value: Math.round(data?.cpuSecondsUsage?.value || 0).toString(),
    },
    {
      label: 'Total Requests',
      value: Math.round(data?.totalRequests?.value || 0).toString(),
    },
    {
      label: 'Function Invocations',
      value: Math.round(data?.functionInvocations?.value || 0).toString(),
    },
    {
      label: 'Egress Volume',
      value: prettifySize(data?.egressVolume?.value || 0),
    },
    {
      label: 'Logs',
      value: prettifySize(data?.logsVolume?.value || 0),
    },
  ];

  if (!data && loading) {
    return (
      <div className="grid grid-flow-row gap-4">
        <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3">
          {cardElements.map((element) => (
            <MetricsCard
              className="h-[92px] animate-pulse"
              key={element.label}
            />
          ))}
        </div>

        <Text color="disabled">
          Your project usage since the beginning of the month.
        </Text>
      </div>
    );
  }

  if (!data && error) {
    throw error;
  }

  return (
    <div className="grid grid-flow-row gap-4">
      <div className="grid grid-cols-1 justify-start gap-4 xs:grid-cols-2 md:grid-cols-3">
        {cardElements.map((element) => (
          <MetricsCard
            label={element.label}
            value={element.value}
            key={element.label}
          />
        ))}
      </div>

      <Text color="disabled">
        Your resource usage since the beginning of the month.
      </Text>
    </div>
  );
}
