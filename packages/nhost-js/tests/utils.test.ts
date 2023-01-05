import { describe, it, expect } from 'vitest'
import { urlFromSubdomain } from '../src/utils/helpers'

describe('urlFromParams', () => {
  describe('when using backendUrl', () => {
    it('should return the full url with the path "/v1/auth" concatenated', async () => {
      const url = urlFromSubdomain({ backendUrl: 'http://localhost' }, 'auth')

      expect(url).toBe('http://localhost/v1/auth')
    })

    it('should return the full url with the path "/v1/storage" concatenated', async () => {
      const url = urlFromSubdomain({ backendUrl: 'http://localhost:1337' }, 'storage')

      expect(url).toBe('http://localhost:1337/v1/storage')
    })
  })

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
