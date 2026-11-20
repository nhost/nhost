import { useCookieConsent } from '@/components/analytics/useCookieConsent'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hooks = vi.hoisted(() => ({
  effects: [] as Array<() => void>,
  setState: vi.fn(),
}))
const segment = vi.hoisted(() => ({ load: vi.fn() }))

vi.mock('react', () => ({
  useCallback: <T>(callback: T) => callback,
  useEffect: (effect: () => void) => hooks.effects.push(effect),
  useState: () => [undefined, hooks.setState],
}))

vi.mock('@segment/analytics-next', () => ({
  AnalyticsBrowser: class {
    load = segment.load
  },
}))

const ANALYTICS_KEYS = [
  'ajs_anonymous_id',
  'ajs_user_id',
  'ajs_user_traits',
  'ajs_group_id',
  'ajs_group_properties',
]

function stubBrowser(consent?: 'accepted' | 'rejected') {
  const storage = new Map<string, string>()
  const cookies = new Map<string, string>()
  for (const key of ANALYTICS_KEYS) {
    storage.set(key, 'old-identifier')
    cookies.set(key, 'old-identifier')
  }
  if (consent) {
    cookies.set('nhost-cookie-consent', consent)
  }

  vi.stubGlobal('window', {
    location: new URL('https://nhost.io/'),
    localStorage: { removeItem: (key: string) => storage.delete(key) },
  })
  vi.stubGlobal('document', {
    get cookie() {
      return Array.from(cookies, ([key, value]) => `${key}=${value}`).join('; ')
    },
    set cookie(value: string) {
      const [entry] = value.split(';')
      const [key, cookieValue] = entry.split('=')
      if (value.includes('Max-Age=0')) {
        cookies.delete(key)
      } else {
        cookies.set(key, cookieValue)
      }
    },
  })

  return { storage, cookies }
}

// Run the hook's mount effects against storage stubs without a DOM dependency.
/* eslint-disable react-hooks/rules-of-hooks -- React hooks are stubbed in this test */
function mountConsent() {
  // biome-ignore lint/correctness/useHookAtTopLevel: React hooks are stubbed in this test
  const result = useCookieConsent()
  for (const effect of hooks.effects) {
    effect()
  }
  return result
}
/* eslint-enable react-hooks/rules-of-hooks */

function expectAnalyticsStorageCleared({
  storage,
  cookies,
}: ReturnType<typeof stubBrowser>) {
  for (const key of ANALYTICS_KEYS) {
    expect(storage.has(key)).toBe(false)
    expect(cookies.has(key)).toBe(false)
  }
  expect(segment.load).not.toHaveBeenCalled()
}

describe('useCookieConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hooks.effects = []
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('clears stored identifiers synchronously when rejecting without loading Segment', () => {
    const browser = stubBrowser('accepted')
    const [, setConsent] = mountConsent()

    setConsent(false)

    expect(browser.cookies.get('nhost-cookie-consent')).toBe('rejected')
    expect(hooks.setState).toHaveBeenLastCalledWith(false)
    expectAnalyticsStorageCleared(browser)
  })

  it('clears stored identifiers for a rejection made on the dashboard', () => {
    const browser = stubBrowser('rejected')

    mountConsent()

    expect(hooks.setState).toHaveBeenCalledWith(false)
    expectAnalyticsStorageCleared(browser)
  })

  it('clears stored identifiers when the choice was reset on the dashboard', () => {
    const browser = stubBrowser()

    mountConsent()

    expect(hooks.setState).toHaveBeenCalledWith(null)
    expectAnalyticsStorageCleared(browser)
  })

  it('preserves identifiers when the saved choice is accepted', () => {
    const { storage, cookies } = stubBrowser('accepted')

    mountConsent()

    expect(hooks.setState).toHaveBeenCalledWith(true)
    for (const key of ANALYTICS_KEYS) {
      expect(storage.get(key)).toBe('old-identifier')
      expect(cookies.get(key)).toBe('old-identifier')
    }
    expect(segment.load).not.toHaveBeenCalled()
  })
})
