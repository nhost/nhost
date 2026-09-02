import {
  BILLING_TABS,
  isBillingTab,
} from '@/features/orgs/components/billing/BillingTabs/types';

describe('billing tab types', () => {
  it('accepts only Phase 2 billing tabs', () => {
    expect(BILLING_TABS).toEqual(['plan', 'usage']);
    expect(isBillingTab('plan')).toBe(true);
    expect(isBillingTab('usage')).toBe(true);
    expect(isBillingTab('invoices')).toBe(false);
    expect(isBillingTab(['usage'])).toBe(false);
    expect(isBillingTab(undefined)).toBe(false);
  });
});
