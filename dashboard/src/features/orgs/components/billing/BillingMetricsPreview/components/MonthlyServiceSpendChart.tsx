import { useMemo } from 'react';
import { Separator } from '@/components/ui/v3/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import {
  BILLING_SERVICE_COLORS,
  BILLING_SERVICE_LABELS,
} from '@/features/orgs/components/billing/BillingMetricsPreview/constants';
import type {
  BillingMetricsData,
  BillingMonthlyInvoice,
} from '@/features/orgs/components/billing/BillingMetricsPreview/types';
import {
  formatBillingMonthLabel,
  formatBillingMonthTick,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/formatBillingDate';
import { formatBillingMoney } from '@/features/orgs/components/billing/BillingMetricsPreview/utils/formatBillingMoney';
import {
  BILLING_SERVICE_SERIES_ACCESSORS,
  toMonthlyInvoiceSeries,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/toMonthlyInvoiceSeries';
import StackedBarMetricChart from '@/features/orgs/projects/common/metrics/components/StackedBarMetricChart';

const DISPLAYED_MONTHS = 4;
const PERCENTAGE_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export interface MonthlyServiceSpendChartProps {
  data: BillingMetricsData;
}

export default function MonthlyServiceSpendChart({
  data,
}: MonthlyServiceSpendChartProps) {
  const { currency, monthlyInvoices } = data;
  const displayedInvoices = useMemo(
    () => monthlyInvoices.slice(-DISPLAYED_MONTHS),
    [monthlyInvoices],
  );
  const series = useMemo(
    () => toMonthlyInvoiceSeries(displayedInvoices),
    [displayedInvoices],
  );
  const upcomingInvoice = monthlyInvoices.find(
    (invoice) => invoice.status === 'upcoming',
  );
  const upcomingTimestamps = useMemo(
    () =>
      displayedInvoices
        .filter((invoice) => invoice.status === 'upcoming')
        .map((invoice) => new Date(invoice.periodStart).getTime()),
    [displayedInvoices],
  );
  const invoiceTotals = useMemo(
    () =>
      new Map(
        displayedInvoices.map((invoice) => [
          new Date(invoice.periodStart).getTime(),
          invoice.amountDueMinor,
        ]),
      ),
    [displayedInvoices],
  );

  return (
    <section
      aria-label="Monthly service charges"
      className="flex flex-col rounded-lg border bg-card p-4 shadow-sm"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_auto_minmax(20rem,2fr)]">
        <div className="flex min-w-0 flex-col">
          <header className="space-y-1">
            <h3 className="font-medium text-foreground text-sm">
              Monthly service charges
            </h3>
            <p className="max-w-prose text-muted-foreground text-xs">
              Four months of charges with a detailed next-invoice estimate.
            </p>
          </header>
          <div className="flex flex-1 items-end">
            <StackedBarMetricChart
              data={series}
              accessors={BILLING_SERVICE_SERIES_ACCESSORS}
              valueFormatter={(value) => formatBillingMoney(value, currency)}
              xTickFormatter={(timestamp) =>
                upcomingTimestamps.includes(timestamp)
                  ? `${formatBillingMonthTick(timestamp)} (est.)`
                  : formatBillingMonthTick(timestamp)
              }
              labelFormatter={(timestamp) =>
                upcomingTimestamps.includes(timestamp)
                  ? `${formatBillingMonthLabel(timestamp)} · Upcoming estimate`
                  : `${formatBillingMonthLabel(timestamp)} · Finalized`
              }
              totalLabel="Amount due"
              totalValueForTimestamp={(timestamp) =>
                invoiceTotals.get(timestamp)
              }
              hatchedTimestamps={upcomingTimestamps}
              height={480}
              maxBarSize={48}
              showLegend={false}
              ariaLabel="Monthly service charges chart"
            />
          </div>
        </div>
        <Separator className="lg:hidden" />
        <Separator orientation="vertical" className="hidden h-full lg:block" />
        <NextInvoiceEstimate invoice={upcomingInvoice} currency={currency} />
      </div>
    </section>
  );
}

interface NextInvoiceEstimateProps {
  invoice?: BillingMonthlyInvoice;
  currency: string;
}

function NextInvoiceEstimate({ invoice, currency }: NextInvoiceEstimateProps) {
  if (!invoice) {
    return (
      <section
        aria-label="Next invoice estimate"
        className="flex min-h-64 items-center justify-center"
      >
        <p className="text-muted-foreground text-sm">
          No upcoming invoice estimate is available.
        </p>
      </section>
    );
  }

  const services = [...invoice.services]
    .filter((service) => service.amountMinor > 0)
    .sort((left, right) => right.amountMinor - left.amountMinor);
  const serviceChargesMinor =
    invoice.serviceChargesMinor > 0
      ? invoice.serviceChargesMinor
      : services.reduce((total, service) => total + service.amountMinor, 0);

  return (
    <section aria-label="Next invoice estimate" className="flex flex-col">
      <header className="space-y-1">
        <h3 className="font-medium text-foreground text-sm">
          Next invoice estimate
        </h3>
        <p className="text-muted-foreground text-xs">
          Estimated amount due for{' '}
          {formatBillingMonthLabel(new Date(invoice.periodStart).getTime())}
        </p>
      </header>

      <Table
        aria-label="Estimated service charge breakdown"
        containerClassName="mt-4 flex-1 overflow-visible"
      >
        <TableHeader className="[&_tr]:border-0">
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead className="h-8 px-0 text-xs">Service</TableHead>
            <TableHead className="h-8 px-2 text-right text-xs">Share</TableHead>
            <TableHead className="h-8 px-0 text-right text-xs">
              Estimate
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service) => {
            const percentage =
              serviceChargesMinor > 0
                ? service.amountMinor / serviceChargesMinor
                : 0;

            return (
              <TableRow
                key={service.key}
                className="border-0 hover:bg-transparent"
              >
                <TableCell className="px-0 py-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <svg aria-hidden className="size-2.5" viewBox="0 0 10 10">
                      <title>Service color</title>
                      <circle
                        cx="5"
                        cy="5"
                        r="5"
                        fill={BILLING_SERVICE_COLORS[service.key]}
                      />
                    </svg>
                    <span className="truncate font-medium">
                      {BILLING_SERVICE_LABELS[service.key]}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                  {PERCENTAGE_FORMATTER.format(percentage)}
                </TableCell>
                <TableCell className="px-0 py-2 text-right font-medium tabular-nums">
                  {formatBillingMoney(service.amountMinor, currency)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="mt-4 space-y-2">
        {invoice.adjustmentsMinor !== 0 ? (
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Invoice adjustments</span>
            <span className="font-medium tabular-nums">
              {formatBillingMoney(invoice.adjustmentsMinor, currency)}
            </span>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-4 font-semibold text-base">
          <span>Estimated total</span>
          <span className="tabular-nums">
            {formatBillingMoney(invoice.amountDueMinor, currency)}
          </span>
        </div>
      </div>
    </section>
  );
}
