const segment = vi.hoisted(() => ({ load: vi.fn(), reset: vi.fn() }));

vi.mock('@segment/analytics-next', () => ({
  AnalyticsBrowser: class {
    load = segment.load;
    reset = segment.reset;
  },
}));

const ANALYTICS_KEYS = [
  'ajs_anonymous_id',
  'ajs_user_id',
  'ajs_user_traits',
  'ajs_group_id',
  'ajs_group_properties',
];

function stubBrowser(url: string, storageBlocked = false) {
  const storage = new Map<string, string>();
  for (const key of ANALYTICS_KEYS) {
    storage.set(key, 'old-identifier');
  }
  storage.set('unrelated', 'preserved');
  const written: string[] = [];

  vi.stubGlobal('window', {
    location: new URL(url),
    get localStorage() {
      if (storageBlocked) {
        throw new Error('Storage blocked');
      }
      return { removeItem: (key: string) => storage.delete(key) };
    },
  });
  vi.stubGlobal('document', {
    set cookie(value: string) {
      written.push(value);
    },
  });

  return { storage, written };
}

describe('analytics storage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    { url: 'https://nhost.io/', shared: true },
    { url: 'https://app.nhost.io/', shared: true },
    { url: 'http://localhost:3000/', shared: false },
    { url: 'https://notnhost.io/', shared: false },
    { url: 'https://nhost.io.example.com/', shared: false },
  ])(
    'clears identifiers without loading Segment on $url',
    async ({ url, shared }) => {
      const { storage, written } = stubBrowser(url);
      const { clearAnalyticsStorage } = await import('@/lib/segment');

      clearAnalyticsStorage();

      expect(Array.from(storage)).toEqual([['unrelated', 'preserved']]);
      expect(written).toEqual(
        ANALYTICS_KEYS.flatMap((key) => {
          const expired = `${key}=; Path=/; Max-Age=0`;
          return shared ? [expired, `${expired}; Domain=nhost.io`] : [expired];
        }),
      );
      clearAnalyticsStorage();
      expect(Array.from(storage)).toEqual([['unrelated', 'preserved']]);
      expect(segment.load).not.toHaveBeenCalled();
      expect(segment.reset).not.toHaveBeenCalled();
    },
  );

  it('still expires every cookie when localStorage access is blocked', async () => {
    const { written } = stubBrowser('https://app.nhost.io/', true);
    const { clearAnalyticsStorage } = await import('@/lib/segment');

    expect(() => clearAnalyticsStorage()).not.toThrow();

    expect(written).toEqual(
      ANALYTICS_KEYS.flatMap((key) => [
        `${key}=; Path=/; Max-Age=0`,
        `${key}=; Path=/; Max-Age=0; Domain=nhost.io`,
      ]),
    );
    expect(segment.load).not.toHaveBeenCalled();
  });

  it('clears storage synchronously on reset even when Segment never loaded', async () => {
    const { storage, written } = stubBrowser('https://app.nhost.io/');
    const { resetAnalytics } = await import('@/lib/segment');

    const reset = resetAnalytics();

    expect(Array.from(storage)).toEqual([['unrelated', 'preserved']]);
    expect(written).toHaveLength(ANALYTICS_KEYS.length * 2);
    expect(segment.load).not.toHaveBeenCalled();
    expect(segment.reset).not.toHaveBeenCalled();
    await reset;
  });

  it.each([false, true])(
    'clears identifiers written during SDK reset even if reset fails (%s)',
    async (fails) => {
      const { storage, written } = stubBrowser('https://app.nhost.io/');
      const { loadAnalytics, resetAnalytics } = await import('@/lib/segment');
      loadAnalytics();
      segment.reset.mockImplementationOnce(() => {
        expect(Array.from(storage)).toEqual([['unrelated', 'preserved']]);
        storage.set('ajs_anonymous_id', 'new-identifier');
        if (fails) {
          throw new Error('Reset failed');
        }
      });

      const reset = resetAnalytics();
      if (fails) {
        await expect(reset).rejects.toThrow('Reset failed');
      } else {
        await reset;
      }

      expect(Array.from(storage)).toEqual([['unrelated', 'preserved']]);
      expect(written).toHaveLength(ANALYTICS_KEYS.length * 4);
    },
  );

  it('is safe outside the browser', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    const { clearAnalyticsStorage } = await import('@/lib/segment');

    expect(() => clearAnalyticsStorage()).not.toThrow();
    expect(segment.load).not.toHaveBeenCalled();
  });
});
