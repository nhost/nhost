import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const segment = vi.hoisted(() => ({
  load: vi.fn(),
  reset: vi.fn(),
  instanceReset: vi.fn(),
}))

vi.mock('@segment/analytics-next', () => ({
  AnalyticsBrowser: class {
    load = segment.load
    reset = segment.reset
    instance = { reset: segment.instanceReset }
  },
}))

const ANALYTICS_KEYS = [
  'ajs_anonymous_id',
  'ajs_user_id',
  'ajs_user_traits',
  'ajs_group_id',
  'ajs_group_properties',
]

function stubBrowser(url: string, storageBlocked = false) {
  const storage = new Map<string, string>()
  for (const key of ANALYTICS_KEYS) {
    storage.set(key, 'old-identifier')
  }
  storage.set('unrelated', 'preserved')
  const written: string[] = []
  const reload = vi.fn(() => {
    expect(written.at(-1)).toBe(
      'nhost-cookie-consent=; Path=/; Max-Age=0; SameSite=Lax; Domain=nhost.io; Secure',
    )
  })

  vi.stubGlobal('window', {
    location: Object.assign(new URL(url), { reload }),
    get localStorage() {
      if (storageBlocked) {
        throw new Error('Storage blocked')
      }
      return { removeItem: (key: string) => storage.delete(key) }
    },
  })
  vi.stubGlobal('document', {
    set cookie(value: string) {
      written.push(value)
    },
  })

  return { storage, written, reload }
}

describe('analytics storage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each([
    { url: 'https://nhost.io/', shared: true },
    { url: 'https://app.nhost.io/', shared: true },
    { url: 'http://localhost:3000/', shared: false },
    { url: 'https://notnhost.io/', shared: false },
    { url: 'https://nhost.io.example.com/', shared: false },
  ])(
    'clears identifiers without loading Segment on $url',
    async ({ url, shared }) => {
      const { storage, written } = stubBrowser(url)
      const { clearAnalyticsStorage } = await import('@/lib/segment')

      clearAnalyticsStorage()

      expect(Array.from(storage)).toEqual([['unrelated', 'preserved']])
      expect(written).toEqual(
        ANALYTICS_KEYS.flatMap((key) => {
          const expired = `${key}=; Path=/; Max-Age=0`
          return shared ? [expired, `${expired}; Domain=nhost.io`] : [expired]
        }),
      )
      clearAnalyticsStorage()
      expect(Array.from(storage)).toEqual([['unrelated', 'preserved']])
      expect(segment.load).not.toHaveBeenCalled()
      expect(segment.reset).not.toHaveBeenCalled()
    },
  )

  it('still expires every cookie when localStorage access is blocked', async () => {
    const { written } = stubBrowser('https://nhost.io/', true)
    const { clearAnalyticsStorage } = await import('@/lib/segment')

    expect(() => clearAnalyticsStorage()).not.toThrow()

    expect(written).toEqual(
      ANALYTICS_KEYS.flatMap((key) => [
        `${key}=; Path=/; Max-Age=0`,
        `${key}=; Path=/; Max-Age=0; Domain=nhost.io`,
      ]),
    )
    expect(segment.load).not.toHaveBeenCalled()
  })

  it('clears storage synchronously on reset even when Segment never loaded', async () => {
    const { storage, written } = stubBrowser('https://nhost.io/')
    const { resetAnalytics } = await import('@/lib/segment')

    resetAnalytics()

    expect(Array.from(storage)).toEqual([['unrelated', 'preserved']])
    expect(written).toHaveLength(ANALYTICS_KEYS.length * 2)
    expect(segment.load).not.toHaveBeenCalled()
    expect(segment.reset).not.toHaveBeenCalled()
  })

  it.each([false, true])(
    'clears identifiers written during SDK reset even if reset fails (%s)',
    async (fails) => {
      const { storage, written } = stubBrowser('https://nhost.io/')
      const { loadAnalytics, resetAnalytics } = await import('@/lib/segment')
      loadAnalytics()
      segment.instanceReset.mockImplementationOnce(() => {
        expect(Array.from(storage)).toEqual([['unrelated', 'preserved']])
        storage.set('ajs_anonymous_id', 'new-identifier')
        if (fails) {
          throw new Error('Reset failed')
        }
      })

      if (fails) {
        expect(() => resetAnalytics()).toThrow('Reset failed')
      } else {
        expect(() => resetAnalytics()).not.toThrow()
      }

      expect(Array.from(storage)).toEqual([['unrelated', 'preserved']])
      expect(written).toHaveLength(ANALYTICS_KEYS.length * 4)
    },
  )

  it.each(['pending', 'rejected'])(
    'deletes consent and reloads when the buffered SDK reset would remain %s',
    async (state) => {
      const { storage, written, reload } = stubBrowser('https://nhost.io/')
      const { analytics, loadAnalytics } = await import('@/lib/segment')
      const { resetCookieConsent } = await import(
        '@/components/analytics/useCookieConsent'
      )
      analytics.instance = undefined
      segment.reset.mockImplementationOnce(() =>
        state === 'pending'
          ? new Promise<void>(() => {})
          : Promise.reject(new Error('Reset failed')),
      )
      loadAnalytics()

      expect(resetCookieConsent()).toBeUndefined()

      expect(Array.from(storage)).toEqual([['unrelated', 'preserved']])
      expect(written).toContain(
        'nhost-cookie-consent=; Path=/; Max-Age=0; SameSite=Lax; Domain=nhost.io; Secure',
      )
      expect(reload).toHaveBeenCalledTimes(1)
      expect(segment.reset).not.toHaveBeenCalled()
      expect(segment.instanceReset).not.toHaveBeenCalled()
    },
  )

  it('deletes consent and reloads without rejecting when the loaded SDK reset throws', async () => {
    const { storage, written, reload } = stubBrowser('https://nhost.io/')
    const { loadAnalytics } = await import('@/lib/segment')
    const { resetCookieConsent } = await import(
      '@/components/analytics/useCookieConsent'
    )
    const error = new Error('Reset failed')
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    segment.instanceReset.mockImplementationOnce(() => {
      storage.set('ajs_anonymous_id', 'new-identifier')
      throw error
    })
    loadAnalytics()

    expect(resetCookieConsent()).toBeUndefined()

    expect(Array.from(storage)).toEqual([['unrelated', 'preserved']])
    expect(written).toContain(
      'nhost-cookie-consent=; Path=/; Max-Age=0; SameSite=Lax; Domain=nhost.io; Secure',
    )
    expect(reload).toHaveBeenCalledTimes(1)
    expect(segment.instanceReset).toHaveBeenCalledTimes(1)
    expect(logError).toHaveBeenCalledWith('Failed to reset analytics:', error)
  })

  it('is safe outside the browser', async () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    const { clearAnalyticsStorage } = await import('@/lib/segment')

    expect(() => clearAnalyticsStorage()).not.toThrow()
    expect(segment.load).not.toHaveBeenCalled()
  })
})
