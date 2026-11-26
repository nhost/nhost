const mocks = vi.hoisted(() => ({
  staticLoad: vi.fn(),
  load: vi.fn(),
  reset: vi.fn(),
  instanceReset: vi.fn(),
  user: vi.fn(),
}));

vi.mock('@segment/analytics-next', () => ({
  AnalyticsBrowser: class {
    static load = mocks.staticLoad;
    load = mocks.load;
    reset = mocks.reset;
    instance = { reset: mocks.instanceReset };
    user = mocks.user;
  },
}));

const env = vi.hoisted(() => ({ platform: true, devOrStaging: false }));

vi.mock('@/utils/env', () => ({ isPlatform: () => env.platform }));
vi.mock('@/utils/helpers', () => ({ isDevOrStaging: () => env.devOrStaging }));

describe('segment', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    env.platform = true;
    env.devOrStaging = false;
  });

  it('loads Segment in production on Nhost Cloud', async () => {
    const { isAnalyticsEnabled, loadAnalytics } = await import('@/lib/segment');

    loadAnalytics();

    expect(isAnalyticsEnabled()).toBe(true);
    expect(mocks.load).toHaveBeenCalledWith(expect.anything(), {
      disable: false,
    });
  });

  it.each([
    { name: 'dev or staging', platform: true, devOrStaging: true },
    { name: 'self-hosted', platform: false, devOrStaging: false },
  ])(
    'loads a no-op Segment when $name, so nothing is fetched, stored or sent',
    async ({ platform, devOrStaging }) => {
      env.platform = platform;
      env.devOrStaging = devOrStaging;
      const { isAnalyticsEnabled, loadAnalytics } = await import(
        '@/lib/segment'
      );

      loadAnalytics();

      expect(isAnalyticsEnabled()).toBe(false);
      expect(mocks.load).toHaveBeenCalledWith(expect.anything(), {
        disable: true,
      });
    },
  );

  it('does not load Segment when imported, so nothing runs before consent', async () => {
    await import('@/lib/segment');

    expect(mocks.staticLoad).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it('loads Segment once', async () => {
    const { loadAnalytics } = await import('@/lib/segment');

    loadAnalytics();
    loadAnalytics();

    expect(mocks.load).toHaveBeenCalledTimes(1);
  });

  it('only resets Segment if it was loaded', async () => {
    const { loadAnalytics, resetAnalytics } = await import('@/lib/segment');

    resetAnalytics();
    expect(mocks.instanceReset).not.toHaveBeenCalled();

    loadAnalytics();
    resetAnalytics();
    expect(mocks.instanceReset).toHaveBeenCalledTimes(1);
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it.each(['pending', 'rejected'])(
    'settles without calling the %s buffered reset when Segment has no instance',
    async (state) => {
      const { analytics, loadAnalytics, resetAnalytics } = await import(
        '@/lib/segment'
      );
      analytics.instance = undefined;
      mocks.reset.mockImplementationOnce(() =>
        state === 'pending'
          ? new Promise<void>(() => {})
          : Promise.reject(new Error('Reset failed')),
      );
      loadAnalytics();

      expect(resetAnalytics()).toBeUndefined();

      expect(mocks.reset).not.toHaveBeenCalled();
      expect(mocks.instanceReset).not.toHaveBeenCalled();
    },
  );

  it('returns no anonymous ID without waiting when Segment is not loaded', async () => {
    const { getAnonId } = await import('@/lib/segment');

    await expect(getAnonId()).resolves.toBeUndefined();
    expect(mocks.user).not.toHaveBeenCalled();
  });
});
