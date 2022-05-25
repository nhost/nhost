import { urlFromParams } from '../src/utils/helpers'

describe('urlFromParams', () => {
  describe('using backendUrl', () => {
    it('should return its value concatenated with "/v1/auth"', async () => {
      const url = urlFromParams({ backendUrl: 'http://localhost' }, 'auth')

      expect(url).toBe('http://localhost/v1/auth')
    })

    it('should return its value concatenated with "/v1/storage"', async () => {
      const url = urlFromParams({ backendUrl: 'http://localhost:1337' }, 'storage')

      expect(url).toBe('http://localhost:1337/v1/storage')
    })
  })

  describe('using subdomain', () => {
    describe('with an actual subdomain and region', () => {
      it('should return the appropriate url', async () => {
        const url = urlFromParams({ subdomain: 'myawesomedomain', region: 'eu-central-1' }, 'auth')

        expect(url).toBe('myawesomedomain.auth.eu-central-1.nhost.run/v1')
      })
    })

    it('should return "http://localhost/v1/auth" when passed "localhost" and "auth"', async () => {
      const url = urlFromParams({ subdomain: 'localhost' }, 'auth')

      expect(url).toBe('http://localhost/v1/auth')
    })

    it('should return "http://localhost:1337/v1/storage" when passed "localhost:1337" and "storage"', async () => {
      const url = urlFromParams({ subdomain: 'localhost:1337' }, 'storage')

      expect(url).toBe('http://localhost:1337/v1/storage')
    })
  })
})
