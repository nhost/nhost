import {
  BILLING_TABS,
  isBillingTab,
} from '@/features/orgs/components/billing/BillingTabs/types';

describe('billing tab types', () => {
  it('accepts all billing tabs and rejects other values', () => {
    expect(BILLING_TABS).toEqual(['plan', 'usage', 'invoices']);
    expect(isBillingTab('plan')).toBe(true);
    expect(isBillingTab('usage')).toBe(true);
    expect(isBillingTab('invoices')).toBe(true);
    expect(isBillingTab('not-a-tab')).toBe(false);
    expect(isBillingTab(['invoices'])).toBe(false);
    expect(isBillingTab(undefined)).toBe(false);
  });
});
