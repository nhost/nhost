import {
  deleteConsentCookie,
  readConsentCookie,
  writeConsentCookie,
} from '@/lib/cookieConsent'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Stubs the bits of `window` and `document` the helpers use, and returns the
// strings written to `document.cookie`.
function stubBrowser(url: string, cookie = '') {
  const written: string[] = []
  const { hostname, protocol } = new URL(url)

  vi.stubGlobal('window', { location: { hostname, protocol } })
  vi.stubGlobal('document', {
    get cookie() {
      return cookie
    },
    set cookie(value: string) {
      written.push(value)
    },
  })

  return written
}

describe('cookieConsent', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it.each(['https://nhost.io/', 'https://app.nhost.io/signup'])(
    'shares the choice across nhost.io and its subdomains (%s)',
    (url) => {
      const written = stubBrowser(url)

      writeConsentCookie(true)

      expect(written).toEqual([
        'nhost-cookie-consent=accepted; Path=/; Max-Age=15552000; SameSite=Lax; Domain=nhost.io; Secure',
      ])
    },
  )

  it.each(['http://localhost:3000/', 'https://notnhost.io/', 'https://nhost.io.example.com/'])(
    'keeps the cookie on the current host elsewhere (%s)',
    (url) => {
      const written = stubBrowser(url)

      writeConsentCookie(false)

      expect(written[0]).toMatch(
        /^nhost-cookie-consent=rejected; Path=\/; Max-Age=15552000; SameSite=Lax(; Secure)?$/,
      )
    },
  )

  it('reads the choice', () => {
    stubBrowser('https://nhost.io/', 'a=1; nhost-cookie-consent=accepted; b=2')
    expect(readConsentCookie()).toBe(true)

    stubBrowser('https://nhost.io/', 'nhost-cookie-consent=rejected')
    expect(readConsentCookie()).toBe(false)

    stubBrowser('https://nhost.io/', 'other-cookie-consent=accepted')
    expect(readConsentCookie()).toBeNull()
  })

  it('deletes the cookie with the same domain and path it was set with', () => {
    const written = stubBrowser('https://app.nhost.io/')

    deleteConsentCookie()

    expect(written).toEqual([
      'nhost-cookie-consent=; Path=/; Max-Age=0; SameSite=Lax; Domain=nhost.io; Secure',
    ])
  })
})
