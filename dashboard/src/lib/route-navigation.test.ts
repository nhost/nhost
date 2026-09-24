import { isQueryActive, isRouteActive } from '@/lib/route-navigation';

describe('isRouteActive', () => {
  it.each([
    ['/settings?tab=version', '/settings?tab=version', false, true],
    ['/settings?tab=capacity', '/settings?tab=version', false, false],
    ['/settings', '/settings?tab=version', false, false],
    ['/settings?tab=', '/settings?tab=version', false, false],
    [
      '/settings?tab=capacity&marker=foo',
      '/settings?tab=capacity',
      false,
      true,
    ],
    [
      '/settings?marker=foo&tab=capacity',
      '/settings?tab=capacity&marker=foo',
      false,
      true,
    ],
    [
      '/settings?tab=capacity',
      '/settings?tab=capacity&marker=foo',
      false,
      false,
    ],
    ['/settings?tab=capacity', '/settings', false, true],
    [
      '/settings/?tab=capacity#details',
      '/settings?tab=capacity#other',
      true,
      true,
    ],
    ['/settings/details?tab=capacity', '/settings?tab=capacity', false, true],
    ['/settings/details?tab=capacity', '/settings?tab=capacity', true, false],
    ['/settings-old?tab=capacity', '/settings?tab=capacity', false, false],
    ['/other?tab=capacity', '/settings?tab=capacity', false, false],
    ['/settings?tab=Capacity', '/settings?tab=capacity', false, false],
    [
      '/settings?tab=Postgres+version',
      '/settings?tab=Postgres%20version',
      false,
      true,
    ],
    ['/settings?tab=cap%61city', '/settings?tab=capacity', false, true],
    [
      '/settings?tab=capacity#tab=version',
      '/settings?tab=version',
      false,
      false,
    ],
    [
      '/settings?tab=capacity#fragment?marker=foo',
      '/settings?tab=capacity&marker=foo',
      false,
      false,
    ],
    [
      '/settings?tab=capacity&tab=version',
      '/settings?tab=capacity',
      false,
      false,
    ],
    [
      '/settings?tab=capacity&tab=capacity',
      '/settings?tab=capacity',
      false,
      false,
    ],
    [
      '/settings?filter=one&filter=two',
      '/settings?filter=one&filter=two',
      false,
      true,
    ],
    [
      '/settings?filter=two&filter=one',
      '/settings?filter=one&filter=two',
      false,
      false,
    ],
    [
      '/settings?tab=version',
      'https://elsewhere.example/settings?tab=version',
      false,
      false,
    ],
  ])(
    'matches %s against %s with exact=%s as %s',
    (current, target, exact, active) => {
      expect(isRouteActive(current, target, exact)).toBe(active);
    },
  );
});

describe('isQueryActive', () => {
  it('compares decoded query objects, including route parameters and arrays', () => {
    expect(
      isQueryActive(
        {
          orgSlug: 'nhost',
          tab: 'capacity',
          filter: ['one', 'two'],
          marker: 'extra',
        },
        { orgSlug: 'nhost', tab: 'capacity', filter: ['one', 'two'] },
      ),
    ).toBe(true);
    expect(
      isQueryActive(
        { orgSlug: 'nhost', tab: 'capacity' },
        { orgSlug: 'another-org', tab: 'capacity' },
      ),
    ).toBe(false);
  });

  it('compares search strings and query objects using the same decoded values', () => {
    expect(
      isQueryActive(
        { label: 'one + two', filter: ['a', 'b'], extra: 'ignored' },
        '?filter=a&filter=b&label=one+%2B+two',
      ),
    ).toBe(true);
    expect(
      isQueryActive('page=2&enabled=true', { page: 2, enabled: true }),
    ).toBe(true);
  });

  it('requires all values for each specified key, preserving repeated-value order', () => {
    expect(
      isQueryActive({ filter: ['one', 'two'] }, { filter: ['one', 'two'] }),
    ).toBe(true);
    expect(
      isQueryActive({ filter: ['two', 'one'] }, { filter: ['one', 'two'] }),
    ).toBe(false);
    expect(isQueryActive({ filter: ['one', 'two'] }, { filter: 'one' })).toBe(
      false,
    );
    expect(
      isQueryActive({ tab: ['capacity', 'version'] }, { tab: 'capacity' }),
    ).toBe(false);
  });

  it('distinguishes an empty value from a missing parameter', () => {
    expect(isQueryActive({}, { tab: '' })).toBe(false);
    expect(isQueryActive({ tab: '' }, { tab: '' })).toBe(true);
  });

  it('does not constrain extra parameters when the destination has no query', () => {
    expect(isQueryActive({ tab: 'capacity', marker: 'foo' }, undefined)).toBe(
      true,
    );
  });
});
