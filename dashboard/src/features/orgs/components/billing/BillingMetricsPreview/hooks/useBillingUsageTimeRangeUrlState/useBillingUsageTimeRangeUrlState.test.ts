import type { ParsedUrlQuery } from 'node:querystring';
import { vi } from 'vitest';
import { useBillingUsageTimeRangeUrlState } from '@/features/orgs/components/billing/BillingMetricsPreview/hooks/useBillingUsageTimeRangeUrlState';
import { DEFAULT_BILLING_USAGE_TIME_RANGE } from '@/features/orgs/components/billing/BillingMetricsPreview/utils/billingUsageTimeRange';
import { renderHook } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

const PATHNAME = '/orgs/[orgSlug]/billing';

function renderWithQuery(query: ParsedUrlQuery) {
  mocks.useRouter.mockReturnValue({
    pathname: PATHNAME,
    query,
    replace: mocks.replace,
  });
  return renderHook(() => useBillingUsageTimeRangeUrlState());
}

describe('useBillingUsageTimeRangeUrlState', () => {
  beforeEach(() => {
    mocks.replace.mockReset();
  });

  it('reads a preset range from the URL', () => {
    const { result } = renderWithQuery({ usageRange: 'previousBillingCycle' });

    expect(result.current.range).toEqual({
      kind: 'preset',
      preset: 'previousBillingCycle',
    });
  });

  it('reads an absolute range from the URL', () => {
    const { result } = renderWithQuery({
      usageFrom: '2026-09-10T00:00:00.000Z',
      usageTo: '2026-09-20T23:59:59.999Z',
    });

    expect(result.current.range).toEqual({
      kind: 'absolute',
      from: '2026-09-10T00:00:00.000Z',
      to: '2026-09-20T23:59:59.999Z',
    });
  });

  it('falls back to the default range for unknown or malformed values', () => {
    expect(renderWithQuery({ usageRange: '1y' }).result.current.range).toEqual(
      DEFAULT_BILLING_USAGE_TIME_RANGE,
    );
    expect(
      renderWithQuery({ usageFrom: 'yesterday', usageTo: 'today' }).result
        .current.range,
    ).toEqual(DEFAULT_BILLING_USAGE_TIME_RANGE);
  });

  it('writes a preset and drops any absolute range, keeping other params', () => {
    const { result } = renderWithQuery({
      orgSlug: 'acme',
      tab: 'usage',
      usageFrom: '2026-09-10T00:00:00.000Z',
      usageTo: '2026-09-20T23:59:59.999Z',
    });

    result.current.setRange({ kind: 'preset', preset: '30d' });

    expect(mocks.replace).toHaveBeenCalledWith(
      {
        pathname: PATHNAME,
        query: { orgSlug: 'acme', tab: 'usage', usageRange: '30d' },
      },
      undefined,
      { shallow: true, scroll: false },
    );
  });

  it('writes an absolute range and drops any preset', () => {
    const { result } = renderWithQuery({
      orgSlug: 'acme',
      tab: 'usage',
      usageRange: 'currentBillingCycle',
    });

    result.current.setRange({
      kind: 'absolute',
      from: '2026-09-10T00:00:00.000Z',
      to: '2026-09-20T23:59:59.999Z',
    });

    expect(mocks.replace).toHaveBeenCalledWith(
      {
        pathname: PATHNAME,
        query: {
          orgSlug: 'acme',
          tab: 'usage',
          usageFrom: '2026-09-10T00:00:00.000Z',
          usageTo: '2026-09-20T23:59:59.999Z',
        },
      },
      undefined,
      { shallow: true, scroll: false },
    );
  });
});
