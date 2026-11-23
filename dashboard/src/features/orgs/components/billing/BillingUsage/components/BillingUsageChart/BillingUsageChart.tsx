import { useMemo } from 'react';
import { DeletedProjectInfo } from '@/features/orgs/components/billing/BillingUsage/components/DeletedProjectInfo';
import { DeletedProjectsInfo } from '@/features/orgs/components/billing/BillingUsage/components/DeletedProjectsInfo';
import {
  BILLING_USAGE_REFERENCE_LINES,
  BILLING_USAGE_REPORT_LABELS,
  BILLING_USAGE_REPORT_UNITS,
} from '@/features/orgs/components/billing/BillingUsage/constants';
import { BILLING_USAGE_SERIES_ACCESSORS } from '@/features/orgs/components/billing/BillingUsage/seriesAccessors';
import type {
  BillingUsageBucket,
  BillingUsageChartView,
  BillingUsageReportType,
  BillingUsageTimeAxis,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { formatBillingDayLabel } from '@/features/orgs/components/billing/BillingUsage/utils/formatBillingDayLabel';
import { formatBillingDayTick } from '@/features/orgs/components/billing/BillingUsage/utils/formatBillingDayTick';
import { StackedBarMetricChart } from '@/features/orgs/projects/common/metrics/components/StackedBarMetricChart';
import type { StackedBarReferenceLine } from '@/features/orgs/projects/common/metrics/components/StackedBarMetricChart/types';
import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';
import { formatInteger } from '@/features/orgs/projects/common/metrics/utils/formatters';

export interface BillingUsageChartProps {
  type: BillingUsageReportType;
  view: BillingUsageChartView;
  series: MetricSeries[];
  buckets: BillingUsageBucket[];
  timeZone: string;
  timeAxis?: BillingUsageTimeAxis;
  nextInvoiceMarkers?: StackedBarReferenceLine[];
  showIncludedUsage: boolean;
  onZoomRange: (first: number, last: number) => void;
  onZoomOut: VoidFunction;
}

export default function BillingUsageChart({
  type,
  view,
  series,
  buckets,
  timeZone,
  timeAxis,
  nextInvoiceMarkers,
  showIncludedUsage,
  onZoomRange,
  onZoomOut,
}: BillingUsageChartProps) {
  const bucketsByTimestamp = useMemo(
    () => new Map(buckets.map((bucket) => [bucket.timestamp, bucket])),
    [buckets],
  );
  const labelsByKey = useMemo(
    () =>
      new Map(
        series.map((item) => [
          BILLING_USAGE_SERIES_ACCESSORS.keyFor(item.labels),
          item.labels,
        ]),
      ),
    [series],
  );
  const label = BILLING_USAGE_REPORT_LABELS[type];
  const unit = BILLING_USAGE_REPORT_UNITS[type];
  const referenceLines = useMemo(() => {
    if (!showIncludedUsage || view !== 'cumulative') {
      return undefined;
    }
    const { value, describe } = BILLING_USAGE_REFERENCE_LINES[type];
    return [{ value, label: describe(`${formatInteger(value)} ${unit}`) }];
  }, [showIncludedUsage, type, unit, view]);

  const formatTooltipLabel = (timestamp: number) => {
    const bucket = bucketsByTimestamp.get(timestamp);
    return bucket
      ? formatBillingDayLabel(bucket, timeZone)
      : formatBillingDayTick(timestamp, timeZone);
  };

  const renderDeletedProjectInfo = (key: string) => {
    const labels = labelsByKey.get(key);
    switch (labels?.projectKind) {
      case 'deleted':
        return <DeletedProjectInfo projectID={labels.projectID} />;
      case 'deletedGroup':
        return (
          <DeletedProjectsInfo count={Number(labels.deletedProjectCount)} />
        );
      default:
        return null;
    }
  };

  return (
    <StackedBarMetricChart
      data={series}
      accessors={BILLING_USAGE_SERIES_ACCESSORS}
      valueFormatter={(value) => `${formatInteger(value)} ${unit}`}
      xTickFormatter={(timestamp) => formatBillingDayTick(timestamp, timeZone)}
      labelFormatter={formatTooltipLabel}
      totalLabel={
        view === 'daily'
          ? `Daily ${label.toLowerCase()}`
          : `Month-to-date ${label.toLowerCase()}`
      }
      filteredTotalLabel={(visibleCount) =>
        visibleCount === 1
          ? 'Selected project total'
          : 'Selected projects total'
      }
      referenceLines={referenceLines}
      verticalReferenceLines={nextInvoiceMarkers}
      timeDomain={timeAxis?.domain}
      xTicks={timeAxis?.ticks}
      minWidth={840}
      maxBarSize={64}
      legendItemAddon={renderDeletedProjectInfo}
      onZoomRange={onZoomRange}
      onZoomOut={onZoomOut}
      emptyLabel={`No ${label.toLowerCase()} reports are available.`}
      ariaLabel={`${label} usage in ${unit} by project`}
    />
  );
}
