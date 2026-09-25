import {
  formatDeletedProjectCount,
  formatDeletedProjectLabel,
  formatUsageShare,
  shortenProjectID,
} from '@/features/orgs/components/billing/BillingMetricsPreview/utils/formatBillingProject';

describe('formatBillingProject', () => {
  it('keeps the first UUID segment and the last four characters', () => {
    expect(shortenProjectID('9e1b7c7a-5c45-44fc-85bc-7a29f29e8f96')).toBe(
      '9e1b7c7a…8f96',
    );
    expect(
      formatDeletedProjectLabel('9e1b7c7a-5c45-44fc-85bc-7a29f29e8f96'),
    ).toBe('Deleted · 9e1b7c7a…8f96');
  });

  it('pluralizes deleted project counts', () => {
    expect(formatDeletedProjectCount(1)).toBe('1 deleted project');
    expect(formatDeletedProjectCount(8)).toBe('8 deleted projects');
  });

  it('never rounds a non-zero share down to 0%', () => {
    expect(formatUsageShare(0)).toBe('<1%');
    expect(formatUsageShare(12)).toBe('12%');
  });
});
