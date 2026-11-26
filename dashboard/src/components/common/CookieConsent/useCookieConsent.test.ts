import { act, renderHook } from '@/tests/testUtils';
import { deleteConsentCookie, writeConsentCookie } from './consentCookie';
import useCookieConsent from './useCookieConsent';

const segment = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock('@segment/analytics-next', () => ({
  AnalyticsBrowser: class {
    load = segment.load;
  },
}));

const ANALYTICS_KEYS = [
  'ajs_anonymous_id',
  'ajs_user_id',
  'ajs_user_traits',
  'ajs_group_id',
  'ajs_group_properties',
];

function seedAnalyticsStorage() {
  for (const key of ANALYTICS_KEYS) {
    window.localStorage.setItem(key, 'old-identifier');
    // biome-ignore lint/suspicious/noDocumentCookie: seed persisted identifiers
    document.cookie = `${key}=old-identifier; Path=/`;
  }
}

function expectAnalyticsStorageCleared() {
  for (const key of ANALYTICS_KEYS) {
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(document.cookie).not.toContain(`${key}=`);
  }
  expect(segment.load).not.toHaveBeenCalled();
}

describe('useCookieConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    deleteConsentCookie();
  });

  it('has no choice until the user makes one', () => {
    const { result } = renderHook(() => useCookieConsent());

    expect(result.current[0]).toBeNull();
  });

  it('saves the choice in a cookie and updates every component using it', () => {
    const banner = renderHook(() => useCookieConsent());
    const signUpPage = renderHook(() => useCookieConsent());

    act(() => banner.result.current[1](true));

    expect(document.cookie).toContain('nhost-cookie-consent=accepted');
    expect(banner.result.current[0]).toBe(true);
    expect(signUpPage.result.current[0]).toBe(true);
  });

  it('clears stored identifiers when rejecting without loading Segment', () => {
    const { result } = renderHook(() => useCookieConsent());
    seedAnalyticsStorage();

    act(() => result.current[1](false));

    expect(result.current[0]).toBe(false);
    expect(document.cookie).toContain('nhost-cookie-consent=rejected');
    expectAnalyticsStorageCleared();
  });

  it('clears stored identifiers for a rejection made on nhost.io', () => {
    writeConsentCookie(false);
    seedAnalyticsStorage();

    const { result } = renderHook(() => useCookieConsent());

    expect(result.current[0]).toBe(false);
    expectAnalyticsStorageCleared();
  });

  it('clears stored identifiers when a rejection is synced to mounted hooks', () => {
    writeConsentCookie(true);
    const { result } = renderHook(() => useCookieConsent());
    seedAnalyticsStorage();

    act(() => {
      writeConsentCookie(false);
      window.dispatchEvent(new Event('nhost-cookie-consent-change'));
    });

    expect(result.current[0]).toBe(false);
    expectAnalyticsStorageCleared();
  });

  it('clears storage on sync even if the resolved rejection is unchanged', () => {
    writeConsentCookie(false);
    renderHook(() => useCookieConsent());
    seedAnalyticsStorage();

    act(() => window.dispatchEvent(new Event('nhost-cookie-consent-change')));

    expectAnalyticsStorageCleared();
  });

  it('clears stored identifiers when the choice was reset on nhost.io', () => {
    seedAnalyticsStorage();

    const { result } = renderHook(() => useCookieConsent());

    expect(result.current[0]).toBeNull();
    expectAnalyticsStorageCleared();
  });

  it('preserves identifiers when the saved choice is accepted', () => {
    writeConsentCookie(true);
    seedAnalyticsStorage();

    const { result } = renderHook(() => useCookieConsent());

    expect(result.current[0]).toBe(true);
    for (const key of ANALYTICS_KEYS) {
      expect(window.localStorage.getItem(key)).toBe('old-identifier');
      expect(document.cookie).toContain(`${key}=old-identifier`);
    }
  });

  it('clears stored identifiers when migrating a legacy rejection', () => {
    window.localStorage.setItem('cookie-consent', 'false');
    seedAnalyticsStorage();

    const { result } = renderHook(() => useCookieConsent());

    expect(result.current[0]).toBe(false);
    expect(document.cookie).toContain('nhost-cookie-consent=rejected');
    expect(window.localStorage.getItem('cookie-consent')).toBeNull();
    expectAnalyticsStorageCleared();
  });

  it('drops a legacy acceptance so the new banner is shown again', () => {
    window.localStorage.setItem('cookie-consent', 'true');

    const { result } = renderHook(() => useCookieConsent());

    expect(result.current[0]).toBeNull();
    expect(document.cookie).not.toContain('nhost-cookie-consent=');
    expect(window.localStorage.getItem('cookie-consent')).toBeNull();
  });
});
