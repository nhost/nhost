import type { ParsedUrlQuery } from 'node:querystring';
import { DEFAULT_BILLING_USAGE_TIME_RANGE } from '@/features/orgs/components/billing/BillingUsage/constants';
import { useBillingUsageTimeRangeUrlState } from '@/features/orgs/components/billing/BillingUsage/hooks/useBillingUsageTimeRangeUrlState';
import { renderHook } from '@/tests/testUtils';

const mocks = vi.hoisted(() => ({
  useRouter: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/router', () => ({
  useRouter: mocks.useRouter,
}));

const PATHNAME = '/orgs/[orgSlug]/billing/usage';

function renderWithQuery(query: ParsedUrlQuery) {
  mocks.useRouter.mockReturnValue({
    pathname: PATHNAME,
    query,
    replace: mocks.replace,
  });
  return renderHook(() => useBillingUsageTimeRangeUrlState());
}

function expectQuery(query: ParsedUrlQuery) {
  expect(mocks.replace).toHaveBeenCalledWith(
    { pathname: PATHNAME, query },
    undefined,
    { shallow: true, scroll: false },
  );
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

  it('reads a range of days from the URL', () => {
    const { result } = renderWithQuery({
      usageFrom: '2026-09-10',
      usageTo: '2026-09-20',
    });

    expect(result.current.range).toEqual({
      kind: 'absolute',
      from: '2026-09-10',
      to: '2026-09-20',
    });
  });

  it.each([
    ['an unknown preset', { usageRange: '1y' }],
    ['words', { usageFrom: 'yesterday', usageTo: 'today' }],
    [
      'a time',
      { usageFrom: '2026-09-10T00:00:00.000Z', usageTo: '2026-09-20' },
    ],
    [
      'a day that does not exist',
      { usageFrom: '2026-02-30', usageTo: '2026-03-02' },
    ],
  ])('falls back to the default range for %s', (_description, query) => {
    expect(renderWithQuery(query).result.current.range).toEqual(
      DEFAULT_BILLING_USAGE_TIME_RANGE,
    );
  });

  it('reads browser time when the URL has no time zone', () => {
    expect(renderWithQuery({}).result.current.timeZone).toBe('browser');
  });

  it('reads UTC from the URL', () => {
    expect(renderWithQuery({ usageTz: 'utc' }).result.current.timeZone).toBe(
      'utc',
    );
  });

  it('falls back to browser time for an unknown time zone', () => {
    expect(renderWithQuery({ usageTz: 'mars' }).result.current.timeZone).toBe(
      'browser',
    );
  });

  it('writes a preset and drops any range of days, keeping other params', () => {
    const { result } = renderWithQuery({
      orgSlug: 'acme',
      usageTz: 'utc',
      usageFrom: '2026-09-10',
      usageTo: '2026-09-20',
    });

    result.current.setRange({ kind: 'preset', preset: '30d' });

    expectQuery({ orgSlug: 'acme', usageTz: 'utc', usageRange: '30d' });
  });

  it('writes a range of days and drops any preset', () => {
    const { result } = renderWithQuery({
      orgSlug: 'acme',
      usageRange: 'currentBillingCycle',
    });

    result.current.setRange({
      kind: 'absolute',
      from: '2026-09-10',
      to: '2026-09-20',
    });

    expectQuery({
      orgSlug: 'acme',
      usageFrom: '2026-09-10',
      usageTo: '2026-09-20',
    });
  });

  it('keeps UTC in the URL', () => {
    const { result } = renderWithQuery({ orgSlug: 'acme' });

    result.current.setTimeZone('utc');

    expectQuery({ orgSlug: 'acme', usageTz: 'utc' });
  });

  it('drops browser time from the URL', () => {
    const { result } = renderWithQuery({ orgSlug: 'acme', usageTz: 'utc' });

    result.current.setTimeZone('browser');

    expectQuery({ orgSlug: 'acme' });
  });
});
