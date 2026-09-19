import {
  BILLING_SERVICE_COLORS,
  BILLING_SERVICE_LABELS,
} from '@/features/orgs/components/billing/BillingMetricsPreview/constants';
import type {
  BillingMonthlyInvoice,
  BillingServiceKey,
} from '@/features/orgs/components/billing/BillingMetricsPreview/types';
import type {
  MetricSeries,
  SeriesAccessors,
} from '@/features/orgs/projects/common/metrics/types';

const BILLING_INVOICE_ADJUSTMENTS_KEY = 'invoiceAdjustments';
const BILLING_INVOICE_ADJUSTMENTS_LABEL = 'Invoice adjustments';
const BILLING_INVOICE_ADJUSTMENTS_COLOR = 'hsl(215 20% 65%)';

export const BILLING_SERVICE_SERIES_ACCESSORS: SeriesAccessors = {
  keyFor: (labels) => labels.serviceKey,
  labelFor: (key, labels) => labels.serviceLabel ?? key,
  colorFor: (key) =>
    key === BILLING_INVOICE_ADJUSTMENTS_KEY
      ? BILLING_INVOICE_ADJUSTMENTS_COLOR
      : (BILLING_SERVICE_COLORS[key as BillingServiceKey] ??
        'hsl(var(--muted-foreground))'),
};

export function toMonthlyInvoiceSeries(
  invoices: BillingMonthlyInvoice[],
): MetricSeries[] {
  const timestamps = invoices.map((invoice) => invoice.periodStart);
  const activeKeys = collectActiveServiceKeys(invoices);
  const serviceSeries = activeKeys.map((key) => ({
    labels: {
      serviceKey: key,
      serviceLabel: BILLING_SERVICE_LABELS[key],
    },
    timestamps,
    datapoints: invoices.map(
      (invoice) =>
        invoice.services.find((service) => service.key === key)?.amountMinor ??
        0,
    ),
  }));

  if (!invoices.some((invoice) => invoice.adjustmentsMinor !== 0)) {
    return serviceSeries;
  }

  return [
    ...serviceSeries,
    {
      labels: {
        serviceKey: BILLING_INVOICE_ADJUSTMENTS_KEY,
        serviceLabel: BILLING_INVOICE_ADJUSTMENTS_LABEL,
      },
      timestamps,
      datapoints: invoices.map((invoice) => invoice.adjustmentsMinor),
    },
  ];
}

function collectActiveServiceKeys(
  invoices: BillingMonthlyInvoice[],
): BillingServiceKey[] {
  const active = new Set<BillingServiceKey>();
  invoices.forEach((invoice) => {
    invoice.services.forEach((service) => {
      if (service.amountMinor > 0) {
        active.add(service.key);
      }
    });
  });
  return Array.from(active);
}
