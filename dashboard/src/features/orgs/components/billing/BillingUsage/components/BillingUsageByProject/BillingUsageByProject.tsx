import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import { BillingSectionCard } from '@/features/orgs/components/billing/BillingUsage/components/BillingSectionCard';
import { BillingUsageChart } from '@/features/orgs/components/billing/BillingUsage/components/BillingUsageChart';
import { BillingUsageTimeRangeFilter } from '@/features/orgs/components/billing/BillingUsage/components/BillingUsageTimeRangeFilter';
import {
  BILLING_USAGE_HISTORY_DAYS,
  BILLING_USAGE_REPORT_LABELS,
  BILLING_USAGE_REPORT_UNITS,
  DEFAULT_BILLING_USAGE_TIME_RANGE,
} from '@/features/orgs/components/billing/BillingUsage/constants';
import { useBillingUsageChartView } from '@/features/orgs/components/billing/BillingUsage/hooks/useBillingUsageChartView';
import { useBillingUsageTimeRangeUrlState } from '@/features/orgs/components/billing/BillingUsage/hooks/useBillingUsageTimeRangeUrlState';
import {
  BILLING_USAGE_REPORT_TYPES,
  type BillingCycle,
  type BillingUsageChartView,
  type BillingUsageRangeBounds,
  type BillingUsageReport,
  type BillingUsageReportType,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { formatDeletedProjectCount } from '@/features/orgs/components/billing/BillingUsage/utils/formatDeletedProjectCount';
import { getBillingUsagePeriod } from '@/features/orgs/components/billing/BillingUsage/utils/getBillingUsagePeriod';
import { getBillingUsageTimeZone } from '@/features/orgs/components/billing/BillingUsage/utils/getBillingUsageTimeZone';
import { groupDeletedProjectSeries } from '@/features/orgs/components/billing/BillingUsage/utils/groupDeletedProjectSeries';
import { resolveBillingUsageTimeRange } from '@/features/orgs/components/billing/BillingUsage/utils/resolveBillingUsageTimeRange';
import { sliceBillingUsageSeries } from '@/features/orgs/components/billing/BillingUsage/utils/sliceBillingUsageSeries';
import { summarizeBillingUsageSeries } from '@/features/orgs/components/billing/BillingUsage/utils/summarizeBillingUsageSeries';
import { toBillingUsageBuckets } from '@/features/orgs/components/billing/BillingUsage/utils/toBillingUsageBuckets';
import { toBillingUsageTimeAxis } from '@/features/orgs/components/billing/BillingUsage/utils/toBillingUsageTimeAxis';
import { toBillingUsageZoomOutRange } from '@/features/orgs/components/billing/BillingUsage/utils/toBillingUsageZoomOutRange';
import { toBillingUsageZoomRange } from '@/features/orgs/components/billing/BillingUsage/utils/toBillingUsageZoomRange';
import { toDailyBillingUsageSeries } from '@/features/orgs/components/billing/BillingUsage/utils/toDailyBillingUsageSeries';
import { toMonthlyCumulativeBillingUsageSeries } from '@/features/orgs/components/billing/BillingUsage/utils/toMonthlyCumulativeBillingUsageSeries';
import { toNextInvoiceMarker } from '@/features/orgs/components/billing/BillingUsage/utils/toNextInvoiceMarker';
import { validateBillingUsageTimeRange } from '@/features/orgs/components/billing/BillingUsage/utils/validateBillingUsageTimeRange';
import {
  formatInteger,
  formatWholePercent,
} from '@/features/orgs/projects/common/metrics/utils/formatters';
import { cn } from '@/lib/utils';

export interface BillingUsageByProjectProps {
  usageReports: BillingUsageReport[];
  currentCycle: BillingCycle;
  refreshing: boolean;
  onRefresh: VoidFunction;
  showIncludedUsage: boolean;
}

export default function BillingUsageByProject({
  usageReports,
  currentCycle,
  refreshing,
  onRefresh,
  showIncludedUsage,
}: BillingUsageByProjectProps) {
  const [selectedType, setSelectedType] =
    useState<BillingUsageReportType>('egress');
  const [chartView, setChartView] = useBillingUsageChartView();
  const {
    range: requestedRange,
    setRange,
    timeZone: timeZoneSetting,
    setTimeZone,
  } = useBillingUsageTimeRangeUrlState();
  const timeZone = getBillingUsageTimeZone(timeZoneSetting);
  const period = useMemo(
    () =>
      getBillingUsagePeriod(
        usageReports,
        BILLING_USAGE_HISTORY_DAYS,
        timeZone,
        currentCycle.end,
      ),
    [currentCycle, timeZone, usageReports],
  );
  const bounds = useMemo<BillingUsageRangeBounds | undefined>(
    () =>
      period
        ? {
            min: period.periodStart,
            max: period.periodEnd,
            currentBillingCycle: currentCycle,
          }
        : undefined,
    [currentCycle, period],
  );
  // A shared link can outlive the retained reports, so a range that no longer
  // fits them falls back to the default.
  const range =
    bounds && validateBillingUsageTimeRange(requestedRange, bounds, timeZone)
      ? DEFAULT_BILLING_USAGE_TIME_RANGE
      : requestedRange;
  const resolvedRange = useMemo(
    () =>
      bounds
        ? resolveBillingUsageTimeRange(range, bounds, timeZone)
        : undefined,
    [bounds, range, timeZone],
  );
  const buckets = useMemo(
    () =>
      period ? toBillingUsageBuckets(period, timeZone, currentCycle.end) : [],
    [currentCycle, period, timeZone],
  );
  const retainedDailySeries = useMemo(
    () => toDailyBillingUsageSeries(usageReports, selectedType, buckets),
    [buckets, selectedType, usageReports],
  );
  const visibleDailySeries = useMemo(
    () =>
      resolvedRange
        ? sliceBillingUsageSeries(retainedDailySeries, buckets, resolvedRange)
        : retainedDailySeries,
    [buckets, resolvedRange, retainedDailySeries],
  );
  const retainedCumulativeSeries = useMemo(
    () => toMonthlyCumulativeBillingUsageSeries(retainedDailySeries, buckets),
    [buckets, retainedDailySeries],
  );
  // Deleted projects only stay in the chart while they have bars in the
  // selected range, so their legend entries and group count match the bars.
  const series = useMemo(() => {
    const retainedSeries =
      chartView === 'daily' ? retainedDailySeries : retainedCumulativeSeries;
    const visibleSeries = resolvedRange
      ? sliceBillingUsageSeries(retainedSeries, buckets, resolvedRange)
      : retainedSeries;
    return groupDeletedProjectSeries(
      visibleSeries.filter(
        (item) =>
          item.labels.projectKind === 'active' ||
          item.datapoints.some((value) => value > 0),
      ),
    );
  }, [
    buckets,
    chartView,
    resolvedRange,
    retainedCumulativeSeries,
    retainedDailySeries,
  ]);
  const summary = useMemo(
    () => summarizeBillingUsageSeries(visibleDailySeries),
    [visibleDailySeries],
  );
  const label = BILLING_USAGE_REPORT_LABELS[selectedType];
  const unit = BILLING_USAGE_REPORT_UNITS[selectedType];
  // Compute is invoiced in whole vCPU-minutes, so the total is rounded to
  // them. It can differ slightly from the invoice, so it's marked as
  // approximate.
  const totalHeadline =
    selectedType === 'dedicatedCompute'
      ? `~${formatInteger(Math.round(summary.total))} ${unit}`
      : `${formatInteger(summary.total)} ${unit}`;
  const timeAxis = useMemo(
    () =>
      resolvedRange
        ? toBillingUsageTimeAxis(
            range,
            resolvedRange,
            currentCycle.end,
            timeZone,
          )
        : undefined,
    [currentCycle, range, resolvedRange, timeZone],
  );
  const timeDomain = timeAxis?.domain;
  const nextInvoiceMarkers = useMemo(() => {
    if (!timeDomain) {
      return undefined;
    }
    const marker = toNextInvoiceMarker(currentCycle.end, timeZone);
    if (marker.value <= timeDomain[0] || marker.value > timeDomain[1]) {
      return undefined;
    }
    return [marker];
  }, [currentCycle, timeDomain, timeZone]);

  const handleTypeChange = (value: string) => {
    setSelectedType(value as BillingUsageReportType);
  };

  const handleChartViewChange = (value: string) => {
    setChartView(value as BillingUsageChartView);
  };

  const handleZoomRange = (first: number, last: number) => {
    if (!bounds) {
      return;
    }
    const zoomRange = toBillingUsageZoomRange(first, last, bounds, timeZone);
    if (zoomRange) {
      setRange(zoomRange);
    }
  };

  const handleZoomOut = () => {
    if (bounds) {
      setRange(toBillingUsageZoomOutRange(range, bounds, timeZone));
    }
  };

  const deletedProjectsNote = summary.deletedProjects
    ? ` Includes ${formatInteger(summary.deletedProjects.total)} ${unit} (${formatWholePercent(summary.deletedProjects.percentage)}) from ${formatDeletedProjectCount(summary.deletedProjects.count)}.`
    : '';

  return (
    <BillingSectionCard
      title="Usage by project"
      description={
        chartView === 'daily'
          ? 'Usage by project for each day.'
          : 'Usage by project, added up from the start of each billing cycle.'
      }
      headerAction={
        <div className="flex items-center gap-2">
          {bounds ? (
            <BillingUsageTimeRangeFilter
              value={range}
              bounds={bounds}
              timeZone={timeZoneSetting}
              onChange={setRange}
              onTimeZoneChange={setTimeZone}
            />
          ) : null}
          <ButtonWithLoading
            variant="outline"
            onClick={onRefresh}
            loading={refreshing}
            data-testid="billingMetricsRefreshButton"
          >
            {!refreshing && <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </ButtonWithLoading>
        </div>
      }
    >
      <Tabs value={selectedType} onValueChange={handleTypeChange}>
        <TabsList aria-label="Usage meter" className="h-auto flex-wrap">
          {BILLING_USAGE_REPORT_TYPES.map((type) => (
            <TabsTrigger key={type} value={type}>
              <span
                aria-hidden="true"
                className={cn('mr-2', BILLING_USAGE_INDICATOR_CLASSES[type])}
              />
              {BILLING_USAGE_REPORT_LABELS[type]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={selectedType}>
          <Tabs value={chartView} onValueChange={handleChartViewChange}>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <section aria-label="Selected usage summary">
                  <UsageSummaryCard
                    headline={totalHeadline}
                    description={`Selected period total for ${label} across all projects.${deletedProjectsNote}`}
                  />
                </section>
                <TabsList
                  aria-label="Chart values"
                  className="self-end justify-self-end"
                >
                  <TabsTrigger value="cumulative">Month to date</TabsTrigger>
                  <TabsTrigger value="daily">Daily</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value={chartView} className="mt-0">
                <BillingUsageChart
                  key={`${selectedType}-${chartView}`}
                  type={selectedType}
                  view={chartView}
                  series={series}
                  buckets={buckets}
                  timeZone={timeZone}
                  timeAxis={timeAxis}
                  nextInvoiceMarkers={nextInvoiceMarkers}
                  showIncludedUsage={showIncludedUsage}
                  onZoomRange={handleZoomRange}
                  onZoomOut={handleZoomOut}
                />
              </TabsContent>
            </div>
          </Tabs>
        </TabsContent>
      </Tabs>
    </BillingSectionCard>
  );
}

function UsageSummaryCard({
  headline,
  description,
}: {
  headline: string;
  description: string;
}) {
  return (
    <article className="flex flex-col gap-1 rounded-lg bg-muted px-4 py-3">
      <p className="truncate font-semibold text-2xl text-foreground tabular-nums">
        {headline}
      </p>
      <p className="text-muted-foreground text-xs">{description}</p>
    </article>
  );
}

const BILLING_USAGE_INDICATOR_CLASSES: Record<BillingUsageReportType, string> =
  {
    egress: 'size-2 shrink-0 rounded-full bg-cyan-500',
    functions: 'size-2 shrink-0 rounded-full bg-orange-500',
    dedicatedCompute: 'size-2 shrink-0 rounded-full bg-teal-500',
  };
