import { urlFromParams } from '../src/utils/helpers'

describe('urlFromParams', () => {
  describe('when using backendUrl', () => {
    it('should return the full url with the path "/v1/auth" concatenated', async () => {
      const url = urlFromParams({ backendUrl: 'http://localhost' }, 'auth')

      expect(url).toBe('http://localhost/v1/auth')
    })

    it('should return the full url with the path "/v1/storage" concatenated', async () => {
      const url = urlFromParams({ backendUrl: 'http://localhost:1337' }, 'storage')

      expect(url).toBe('http://localhost:1337/v1/storage')
    })
  })

  describe('using subdomain', () => {
    describe('other than "localhost" and a region', () => {
      it('should return the full authentication url', async () => {
        const url = urlFromParams({ subdomain: 'mysubdomain', region: 'eu-central-1' }, 'auth')

        expect(url).toBe('https://mysubdomain.auth.eu-central-1.nhost.run/v1')
      })
    })

    describe('other than "localhost" without a region', () => {
      it('should throw an error', async () => {
        expect(() => {
          urlFromParams({ subdomain: 'mysubdomain' }, 'auth')
        }).toThrow()
      })
    })

    describe('"localhost" without a custom port', () => {
      it('should use port 1337 and return "http://localhost:1337/v1/auth"', async () => {
        const url = urlFromParams({ subdomain: 'localhost:1337' }, 'auth')

        expect(url).toBe('http://localhost:1337/v1/auth')
      })
    })

    describe('"localhost" with a custom port', () => {
      it('should use the specified port and return "http://localhost:2001/v1/auth"', async () => {
        const url = urlFromParams({ subdomain: 'localhost:2001' }, 'auth')

        expect(url).toBe('http://localhost:2001/v1/auth')
      })
    })
  })
})
