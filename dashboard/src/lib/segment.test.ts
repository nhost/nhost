const mocks = vi.hoisted(() => ({
  staticLoad: vi.fn(),
  load: vi.fn(),
  reset: vi.fn(),
  user: vi.fn(),
}));

vi.mock('@segment/analytics-next', () => ({
  AnalyticsBrowser: class {
    static load = mocks.staticLoad;
    load = mocks.load;
    reset = mocks.reset;
    user = mocks.user;
  },
}));

const env = vi.hoisted(() => ({ platform: true, devOrStaging: false }));

vi.mock('@/utils/env', () => ({ isPlatform: () => env.platform }));
vi.mock('@/utils/helpers', () => ({ isDevOrStaging: () => env.devOrStaging }));

describe('segment', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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

    await resetAnalytics();
    expect(mocks.reset).not.toHaveBeenCalled();

    loadAnalytics();
    await resetAnalytics();
    expect(mocks.reset).toHaveBeenCalledTimes(1);
  });

  it('returns no anonymous ID without waiting when Segment is not loaded', async () => {
    const { getAnonId } = await import('@/lib/segment');

    await expect(getAnonId()).resolves.toBeUndefined();
    expect(mocks.user).not.toHaveBeenCalled();
  });
});
