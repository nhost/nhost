import type { BillingMonthlyInvoice } from '@/features/orgs/components/billing/BillingMetricsPreview/types';
import {
  BILLING_SERVICE_SERIES_ACCESSORS,
  toMonthlyInvoiceSeries,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/toMonthlyInvoiceSeries';

const invoices: BillingMonthlyInvoice[] = [
  {
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-08-01T00:00:00.000Z',
    status: 'finalized',
    serviceChargesMinor: 4000,
    adjustmentsMinor: -300,
    amountDueMinor: 3700,
    services: [
      { key: 'plan', amountMinor: 2500 },
      { key: 'egress', amountMinor: 1500 },
    ],
  },
  {
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-09-01T00:00:00.000Z',
    status: 'upcoming',
    serviceChargesMinor: 4500,
    adjustmentsMinor: 0,
    amountDueMinor: 4500,
    services: [
      { key: 'plan', amountMinor: 2500 },
      { key: 'egress', amountMinor: 2000 },
    ],
  },
];

describe('toMonthlyInvoiceSeries', () => {
  it('creates one index-aligned series per active service', () => {
    expect(toMonthlyInvoiceSeries(invoices)).toEqual([
      {
        labels: { serviceKey: 'plan', serviceLabel: 'Plan' },
        timestamps: ['2026-07-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'],
        datapoints: [2500, 2500],
      },
      {
        labels: { serviceKey: 'egress', serviceLabel: 'Egress' },
        timestamps: ['2026-07-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'],
        datapoints: [1500, 2000],
      },
      {
        labels: {
          serviceKey: 'invoiceAdjustments',
          serviceLabel: 'Invoice adjustments',
        },
        timestamps: ['2026-07-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'],
        datapoints: [-300, 0],
      },
    ]);
  });

  it('uses stable service keys, labels and colors', () => {
    const labels = { serviceKey: 'egress', serviceLabel: 'Egress' };

    expect(BILLING_SERVICE_SERIES_ACCESSORS.keyFor(labels)).toBe('egress');
    expect(BILLING_SERVICE_SERIES_ACCESSORS.labelFor('egress', labels)).toBe(
      'Egress',
    );
    expect(BILLING_SERVICE_SERIES_ACCESSORS.colorFor('egress', labels, 0)).toBe(
      BILLING_SERVICE_SERIES_ACCESSORS.colorFor('egress', labels, 7),
    );
  });
});
