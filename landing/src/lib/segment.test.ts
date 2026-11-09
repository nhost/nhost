import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  staticLoad: vi.fn(),
  load: vi.fn(),
  reset: vi.fn(),
}))

vi.mock('@segment/analytics-next', () => ({
  AnalyticsBrowser: class {
    static load = mocks.staticLoad
    load = mocks.load
    reset = mocks.reset
  },
}))

describe('segment', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([undefined, 'development', 'preview'])(
    'loads a no-op Segment outside production (%s), so nothing is fetched, stored or sent',
    async (env) => {
      vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', env)
      const { loadAnalytics } = await import('@/lib/segment')

      loadAnalytics()

      expect(mocks.load).toHaveBeenCalledWith(expect.anything(), { disable: true })
    },
  )

  it('loads Segment in production', async () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production')
    const { loadAnalytics } = await import('@/lib/segment')

    loadAnalytics()

    expect(mocks.load).toHaveBeenCalledWith(expect.anything(), { disable: false })
  })

  it('does not load Segment when imported, so nothing runs before consent', async () => {
    await import('@/lib/segment')

    expect(mocks.staticLoad).not.toHaveBeenCalled()
    expect(mocks.load).not.toHaveBeenCalled()
  })

  it('loads Segment once', async () => {
    const { loadAnalytics } = await import('@/lib/segment')

    loadAnalytics()
    loadAnalytics()

    expect(mocks.load).toHaveBeenCalledTimes(1)
  })

  it('only resets Segment if it was loaded', async () => {
    const { loadAnalytics, resetAnalytics } = await import('@/lib/segment')

    await resetAnalytics()
    expect(mocks.reset).not.toHaveBeenCalled()

    loadAnalytics()
    await resetAnalytics()
    expect(mocks.reset).toHaveBeenCalledTimes(1)
  })
})
