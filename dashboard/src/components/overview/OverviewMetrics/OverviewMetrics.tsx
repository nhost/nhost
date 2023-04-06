import type { MetricsCardProps } from '@/components/overview/MetricsCard';
import { MetricsCard } from '@/components/overview/MetricsCard';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import Text from '@/ui/v2/Text';
import { useGetProjectMetricsQuery } from '@/utils/__generated__/graphql';
import { prettifyNumber } from '@/utils/common/prettifyNumber';
import { prettifySize } from '@/utils/common/prettifySize';
import useTranslation from 'next-translate/useTranslation';
import { twMerge } from 'tailwind-merge';

const now = new Date();

export default function OverviewMetrics() {
  const { t } = useTranslation('overview');
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
      label: t('metrics.cpuUsageSeconds.label'),
      tooltip: t('metrics.cpuUsageSeconds.tooltip'),
      value: prettifyNumber(data?.cpuSecondsUsage?.value || 0),
    },
    {
      label: t('metrics.totalRequests.label'),
      tooltip: t('metrics.totalRequests.tooltip'),
      value: prettifyNumber(data?.totalRequests?.value || 0, {
        numberOfDecimals: data?.totalRequests?.value > 1000 ? 2 : 0,
      }),
    },
    {
      label: t('metrics.functionInvocations.label'),
      tooltip: t('metrics.functionInvocations.tooltip'),
      value: prettifyNumber(data?.functionInvocations?.value || 0, {
        numberOfDecimals: 0,
      }),
    },
    {
      label: t('metrics.egressVolume.label'),
      tooltip: t('metrics.egressVolume.tooltip'),
      value: prettifySize(data?.egressVolume?.value || 0),
    },
    {
      label: t('metrics.logs.label'),
      tooltip: t('metrics.logs.tooltip'),
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

      <Text color="disabled">{t('metrics.helperText')}</Text>
    </div>
  );
}
