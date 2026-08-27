import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/v3/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import BillingSectionCard from '@/features/orgs/components/billing/BillingMetricsPreview/components/BillingSectionCard';
import BillingUsageTimeRangeFilter from '@/features/orgs/components/billing/BillingMetricsPreview/components/BillingUsageTimeRangeFilter';
import {
  BILLING_USAGE_HISTORY_DAYS,
  BILLING_USAGE_REFERENCE_LINES,
  BILLING_USAGE_REPORT_LABELS,
  BILLING_USAGE_REPORT_UNITS,
} from '@/features/orgs/components/billing/BillingMetricsPreview/constants';
import {
  BILLING_USAGE_REPORT_TYPES,
  type BillingMetricsData,
  type BillingUsageReportType,
} from '@/features/orgs/components/billing/BillingMetricsPreview/types';
import {
  type BillingUsageRangeBounds,
  type BillingUsageTimeRange,
  DEFAULT_BILLING_USAGE_TIME_RANGE,
  resolveBillingUsageTimeRange,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/billingUsageTimeRange';
import {
  formatBillingDayLabel,
  formatBillingDayTick,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/formatBillingDate';
import {
  BILLING_USAGE_SERIES_ACCESSORS,
  getBillingUsagePeriod,
  sliceBillingUsageSeries,
  summarizeBillingUsageSeries,
  toDailyBillingUsageSeries,
  toMonthlyCumulativeBillingUsageSeries,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/toBillingUsageSeries';
import StackedBarMetricChart from '@/features/orgs/projects/common/metrics/components/StackedBarMetricChart';
import { formatInteger } from '@/features/orgs/projects/common/metrics/utils/formatters';

export interface BillingUsageChartProps {
  data: BillingMetricsData;
  refreshing: boolean;
  onRefresh: VoidFunction;
}

export default function BillingUsageChart({
  data,
  refreshing,
  onRefresh,
}: BillingUsageChartProps) {
  const [selectedType, setSelectedType] =
    useState<BillingUsageReportType>('egress');
  const [range, setRange] = useState<BillingUsageTimeRange>(
    DEFAULT_BILLING_USAGE_TIME_RANGE,
  );
  const period = useMemo(
    () => getBillingUsagePeriod(data.usageReports, BILLING_USAGE_HISTORY_DAYS),
    [data.usageReports],
  );
  const currentInvoice = data.monthlyInvoices.find(
    (invoice) => invoice.status === 'upcoming',
  );
  const bounds = useMemo<BillingUsageRangeBounds | undefined>(
    () =>
      period && currentInvoice
        ? {
            min: period.periodStart,
            max: period.latestReportEnd,
            currentBillingCycleStart: currentInvoice.periodStart,
          }
        : undefined,
    [currentInvoice, period],
  );
  const resolvedRange = useMemo(
    () => (bounds ? resolveBillingUsageTimeRange(range, bounds) : undefined),
    [bounds, range],
  );
  const retainedDailySeries = useMemo(
    () =>
      period
        ? toDailyBillingUsageSeries(
            data.usageReports,
            selectedType,
            period.periodStart,
            period.periodEnd,
          )
        : [],
    [data.usageReports, period, selectedType],
  );
  const visibleDailySeries = useMemo(
    () =>
      resolvedRange
        ? sliceBillingUsageSeries(
            retainedDailySeries,
            resolvedRange.from,
            resolvedRange.to,
          )
        : retainedDailySeries,
    [resolvedRange, retainedDailySeries],
  );
  const retainedCumulativeSeries = useMemo(
    () => toMonthlyCumulativeBillingUsageSeries(retainedDailySeries),
    [retainedDailySeries],
  );
  const series = useMemo(
    () =>
      resolvedRange
        ? sliceBillingUsageSeries(
            retainedCumulativeSeries,
            resolvedRange.from,
            resolvedRange.to,
          )
        : retainedCumulativeSeries,
    [resolvedRange, retainedCumulativeSeries],
  );
  const summary = useMemo(
    () => summarizeBillingUsageSeries(visibleDailySeries),
    [visibleDailySeries],
  );
  const label = BILLING_USAGE_REPORT_LABELS[selectedType];
  const unit = BILLING_USAGE_REPORT_UNITS[selectedType];
  const usageReferenceLine = BILLING_USAGE_REFERENCE_LINES[selectedType];
  const timeDomain = useMemo<[number, number] | undefined>(() => {
    if (!resolvedRange) {
      return undefined;
    }
    const from = startOfUtcDay(resolvedRange.from.getTime());
    const to =
      range.kind === 'preset' &&
      range.preset === 'currentBillingCycle' &&
      currentInvoice
        ? new Date(currentInvoice.periodEnd).getTime() +
          INVOICE_MARKER_PADDING_DAYS * DAY_MS
        : resolvedRange.to.getTime();
    return [from, to];
  }, [currentInvoice, range, resolvedRange]);
  const xTicks = useMemo(
    () => (timeDomain ? createWeeklyTicks(timeDomain) : undefined),
    [timeDomain],
  );
  const invoicePeriodMarkers = useMemo(
    () =>
      timeDomain
        ? data.monthlyInvoices
            .map((invoice) => ({
              invoice,
              periodEnd: new Date(invoice.periodEnd).getTime(),
            }))
            .filter(
              ({ periodEnd }) =>
                periodEnd > timeDomain[0] && periodEnd <= timeDomain[1],
            )
            .map(({ invoice, periodEnd }) => ({
              value: periodEnd,
              label: `${invoice.status === 'upcoming' ? 'Next invoice' : 'Invoice'} · ${formatBillingDayTick(periodEnd)}`,
            }))
        : undefined,
    [data.monthlyInvoices, timeDomain],
  );

  const handleTypeChange = (value: string) => {
    if (isBillingUsageReportType(value)) {
      setSelectedType(value);
    }
  };

  return (
    <BillingSectionCard
      title="Usage by project"
      description="Month-to-date usage by project."
      headerAction={
        <div className="flex items-center gap-2">
          {bounds ? (
            <BillingUsageTimeRangeFilter
              value={range}
              bounds={bounds}
              onChange={setRange}
            />
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <ButtonWithLoading
                variant="outline"
                size="icon"
                onClick={onRefresh}
                loading={refreshing}
                loaderClassName="mr-0 h-4 w-4"
                aria-label="Refresh metrics"
                data-testid="billingMetricsRefreshButton"
              >
                {!refreshing && <RefreshCw className="h-4 w-4" />}
              </ButtonWithLoading>
            </TooltipTrigger>
            <TooltipContent>Refresh metrics</TooltipContent>
          </Tooltip>
        </div>
      }
    >
      <Tabs value={selectedType} onValueChange={handleTypeChange}>
        <TabsList aria-label="Usage meter" className="h-auto flex-wrap">
          {BILLING_USAGE_REPORT_TYPES.map((type) => (
            <TabsTrigger className="gap-2" key={type} value={type}>
              <span
                aria-hidden="true"
                className={BILLING_USAGE_INDICATOR_CLASSES[type]}
              />
              {BILLING_USAGE_REPORT_LABELS[type]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={selectedType} className="flex flex-col gap-3">
          <section
            aria-label="Selected usage summary"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <UsageSummaryCard
              headline={`${formatInteger(summary.total)} ${unit}`}
              description={`Selected period total for ${label} across all projects.`}
            />
            <UsageSummaryCard
              headline={summary.topProject?.name ?? '—'}
              description={
                summary.topProject
                  ? `${summary.topProject.percentage}% of selected-period ${label.toLowerCase()} · ${formatInteger(summary.topProject.total)} ${unit}`
                  : `No ${label.toLowerCase()} usage in the selected period.`
              }
            />
          </section>
          <StackedBarMetricChart
            data={series}
            accessors={BILLING_USAGE_SERIES_ACCESSORS}
            valueFormatter={(value) => `${formatInteger(value)} ${unit}`}
            xTickFormatter={formatBillingDayTick}
            labelFormatter={formatBillingDayLabel}
            totalLabel={`Month-to-date ${label.toLowerCase()}`}
            referenceLines={[usageReferenceLine]}
            verticalReferenceLines={invoicePeriodMarkers}
            timeDomain={timeDomain}
            xTicks={xTicks}
            hatchedTimestamps={period ? [period.latestDay] : undefined}
            minWidth={840}
            maxBarSize={28}
            emptyLabel={`No ${label.toLowerCase()} reports are available.`}
            ariaLabel={`${label} usage in ${unit} by project`}
          />
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

function isBillingUsageReportType(
  value: string,
): value is BillingUsageReportType {
  return BILLING_USAGE_REPORT_TYPES.some((type) => type === value);
}

const BILLING_USAGE_INDICATOR_CLASSES: Record<BillingUsageReportType, string> =
  {
    egress: 'size-2 shrink-0 rounded-full bg-cyan-500',
    functions: 'size-2 shrink-0 rounded-full bg-orange-500',
    dedicatedCompute: 'size-2 shrink-0 rounded-full bg-teal-500',
  };

const DAY_MS = 24 * 60 * 60 * 1000;
const INVOICE_MARKER_PADDING_DAYS = 2;

function createWeeklyTicks([from, to]: [number, number]): number[] {
  const ticks: number[] = [];
  for (let timestamp = from; timestamp <= to; timestamp += 7 * DAY_MS) {
    ticks.push(timestamp);
  }
  if (ticks[ticks.length - 1] !== to) {
    ticks.push(to);
  }
  return ticks;
}

function startOfUtcDay(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
