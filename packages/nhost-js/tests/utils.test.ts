import { describe, expect, it } from 'vitest'
import { buildUrl, LOCALHOST_REGEX, urlFromSubdomain } from '../src/utils/helpers'

describe('urlFromParams', () => {
  describe('using subdomain', () => {
    describe('other than "localhost" and a region', () => {
      it('should return the full authentication url', async () => {
        const url = urlFromSubdomain({ subdomain: 'mysubdomain', region: 'eu-central-1' }, 'auth')

        expect(url).toBe('https://mysubdomain.auth.eu-central-1.nhost.run/v1')
      })
    })

    describe('other than "localhost" without a region', () => {
      it('should throw an error', async () => {
        expect(() => {
          urlFromSubdomain({ subdomain: 'mysubdomain' }, 'auth')
        }).toThrow()
      })
    })

    describe('"localhost" without a custom port', () => {
      it('should use port 1337 when none provided and return "http://localhost:1337/v1/auth"', async () => {
        const url = urlFromSubdomain({ subdomain: 'localhost' }, 'auth')

        expect(url).toBe('http://localhost:1337/v1/auth')
      })
      it('should use given port and return "http://localhost:1337/v1/auth"', async () => {
        const url = urlFromSubdomain({ subdomain: 'localhost:8000' }, 'auth')

        expect(url).toBe('http://localhost:8000/v1/auth')
      })
      it('should work with http', async () => {
        const url = urlFromSubdomain({ subdomain: 'http://localhost:1337' }, 'auth')

        expect(url).toBe('http://localhost:1337/v1/auth')
      })
      it('should work with https', async () => {
        const url = urlFromSubdomain({ subdomain: 'https://localhost:1337' }, 'auth')

        expect(url).toBe('https://localhost:1337/v1/auth')
      })
    })

    describe('"local" without a custom port', () => {
      it('should return the full authentication url', async () => {
        const url = urlFromSubdomain({ subdomain: 'local' }, 'auth')

        expect(url).toBe('https://local.auth.nhost.run/v1')
      })

      it('should return the full storage url', async () => {
        const url = urlFromSubdomain({ subdomain: 'local' }, 'storage')

        expect(url).toBe('https://local.storage.nhost.run/v1')
      })

      it('should return the full GraphQL url', async () => {
        const url = urlFromSubdomain({ subdomain: 'local' }, 'graphql')

        expect(url).toBe('https://local.graphql.nhost.run/v1')
      })

      it('should return the full functions url', async () => {
        const url = urlFromSubdomain({ subdomain: 'local' }, 'functions')

        expect(url).toBe('https://local.functions.nhost.run/v1')
      })

      it('should return the full Hasura url', async () => {
        const url = urlFromSubdomain({ subdomain: 'local' }, 'hasura')

        expect(url).toBe('https://local.hasura.nhost.run/v1')
      })
    })

    describe('"localhost" with a custom port', () => {
      it('should use the specified port and return "http://localhost:2001/v1/auth"', async () => {
        const url = urlFromSubdomain({ subdomain: 'localhost:2001' }, 'auth')

        expect(url).toBe('http://localhost:2001/v1/auth')
      })
    })

    describe('"localhost" with a placeholder for custom port', () => {
      it('should use the specified placeholder and return "http://localhost:__FOO_BAR__/v1/auth"', async () => {
        const url = urlFromSubdomain({ subdomain: 'localhost:__FOO_BAR__' }, 'auth')

        expect(url).toBe('http://localhost:__FOO_BAR__/v1/auth')
      })
    })

    describe('"localhost" with invalid custom port', () => {
      it('should throw an error"', async () => {
        expect(() => {
          urlFromSubdomain({ subdomain: 'localhost:_invalid_FOO_BAR__' }, 'auth')
        }).toThrow()
      })
    })
  })
})

describe('buildUrl', () => {
  it('should combine base URL and path', () => {
    const baseUrl = 'https://example.com'
    const path = '/api/users'
    expect(buildUrl(baseUrl, path)).toBe('https://example.com/api/users')
  })

  it('should add missing leading slash to path', () => {
    const baseUrl = 'https://example.com'
    const path = 'api/users'
    expect(buildUrl(baseUrl, path)).toBe('https://example.com/api/users')
  })

  it('should handle empty base URL', () => {
    const baseUrl = ''
    const path = '/api/users'
    expect(buildUrl(baseUrl, path)).toBe('/api/users')
  })

  it('should handle empty path', () => {
    const baseUrl = 'https://example.com'
    const path = ''
    expect(buildUrl(baseUrl, path)).toBe('https://example.com/')
  })

  it('should handle missing parameters', () => {
    // @ts-ignore
    expect(() => buildUrl()).toThrow()
    // @ts-ignore
    expect(() => buildUrl('https://example.com')).toThrow()
  })
})

describe('LOCALHOST_REGEX', () => {
  it('should match localhost without protocol or port', () => {
    const input = 'localhost'
    const match = input.match(LOCALHOST_REGEX)
    expect(match?.groups).toEqual({ host: 'localhost', protocol: undefined, port: undefined })
  })

  it('should match localhost with http protocol', () => {
    const input = 'http://localhost'
    const match = input.match(LOCALHOST_REGEX)
    expect(match?.groups).toEqual({ host: 'localhost', protocol: 'http', port: undefined })
  })

  it('should match localhost with https protocol and port', () => {
    const input = 'https://localhost:8443'
    const match = input.match(LOCALHOST_REGEX)
    expect(match?.groups).toEqual({ host: 'localhost', protocol: 'https', port: '8443' })
  })

  it('should match localhost with named port placeholder', () => {
    const input = 'http://localhost:__PORT_NAME__'
    const match = input.match(LOCALHOST_REGEX)
    expect(match?.groups).toEqual({ host: 'localhost', protocol: 'http', port: '__PORT_NAME__' })
  })

  it('should not match other URLs', () => {
    const input1 = 'https://www.example.com'
    const input2 = 'http://127.0.0.1:3000'
    const match1 = input1.match(LOCALHOST_REGEX)
    const match2 = input2.match(LOCALHOST_REGEX)
    expect(match1).toBeNull()
    expect(match2).toBeNull()
  })
})
