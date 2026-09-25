export const BILLING_TABS = ['plan', 'usage', 'invoices'] as const;

export type BillingTab = (typeof BILLING_TABS)[number];

export function isBillingTab(value: unknown): value is BillingTab {
  return (
    typeof value === 'string' &&
    (BILLING_TABS as readonly string[]).includes(value)
  );
}
