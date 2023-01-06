import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createNhostClient } from '../src'

const cloud = 'goiqxsyjxufxlprgiprm'
const local = 'localhost'

describe('NhostClient', () => {
  describe('being used with Nhost Cloud', () => {
    const nhostCloud = createNhostClient({ subdomain: cloud, region: 'eu-central-1' })

    it('should create a new nhost client when a valid subdomain and region are specified', () => {
      expect(nhostCloud).toBeTruthy()
    })

    it('should throw an error if a subdomain is provided but not a region', () => {
      expect(() => {
        createNhostClient({ subdomain: cloud })
      }).toThrow()
    })

    describe('Endpoints', () => {
      it('should have the right auth endpoint set', () => {
        expect(nhostCloud.auth.url).toBe(`https://${cloud}.auth.eu-central-1.nhost.run/v1`)
      })

      it('should have the right storage endpoint set', () => {
        expect(nhostCloud.storage.url).toBe(`https://${cloud}.storage.eu-central-1.nhost.run/v1`)
      })

      it('should have the right graphql endpoint set', () => {
        expect(nhostCloud.graphql.httpUrl).toBe(
          `https://${cloud}.graphql.eu-central-1.nhost.run/v1`
        )
      })

      it('should have the right functions endpoint set', () => {
        expect(nhostCloud.functions.url).toBe(
          `https://${cloud}.functions.eu-central-1.nhost.run/v1`
        )
      })
    })
  })

  describe('being used with Nhost Local (CLI)', () => {
    const originalEnv = process.env
    const nhostLocal = createNhostClient({ subdomain: local })
    beforeEach(() => {
      vi.resetModules()
      process.env = {
        ...originalEnv,
        NHOST_AUTH_URL: 'http://traefik:1337/v1/auth',
        NHOST_STORAGE_URL: 'http://traefik:1337/v1/storage',
        NHOST_GRAPHQL_URL: 'http://traefik:1337/v1/graphql',
        NHOST_FUNCTIONS_URL: 'http://traefik:1337/v1/functions'
      }
    })
    afterEach(() => {
      process.env = originalEnv
    })

    it('should create a new nhost client when `localhost` is specified', () => {
      expect(nhostLocal).toBeTruthy()
    })

    describe('Endpoints', () => {
      it('should have the right auth endpoint set', () => {
        expect(nhostLocal.auth.url).toBe('http://localhost:1337/v1/auth')
      })

      it('should have the right storage endpoint set', () => {
        expect(nhostLocal.storage.url).toBe('http://localhost:1337/v1/storage')
      })

      it('should have the right graphql endpoint set', () => {
        expect(nhostLocal.graphql.httpUrl).toBe('http://localhost:1337/v1/graphql')
      })

      it('should have the right functions endpoint set', () => {
        expect(nhostLocal.functions.url).toBe('http://localhost:1337/v1/functions')
      })
    })

    describe('Custom endpoints', () => {
      it('should use the value in NHOST_AUTH_URL if set', () => {
        const nhostLocal = createNhostClient({ subdomain: local })
        expect(nhostLocal.auth.url).toBe('http://traefik:1337/v1/auth')
      })

      it('should use the value in NHOST_STORAGE_URL if set', () => {
        const nhostLocal = createNhostClient({ subdomain: local })
        expect(nhostLocal.storage.url).toBe('http://traefik:1337/v1/storage')
      })

      it('should use the value in NHOST_GRAPHQL_URL if set', () => {
        const nhostLocal = createNhostClient({ subdomain: local })
        expect(nhostLocal.graphql.httpUrl).toBe('http://traefik:1337/v1/graphql')
      })

      it('should use the value in NHOST_FUNCTIONS_URL if set', () => {
        const nhostLocal = createNhostClient({ subdomain: local })
        expect(nhostLocal.functions.url).toBe('http://traefik:1337/v1/functions')
      })
    })
  })

  describe('self hosting', () => {
    it('should use the individual url parameters', () => {
      const nhost = createNhostClient({
        authUrl: 'http://localhost:1337/v1/auth',
        storageUrl: 'http://localhost:1337/v1/storage',
        graphqlUrl: 'http://localhost:1337/v1/graphql',
        functionsUrl: 'http://localhost:1337/v1/functions'
      })
      expect(nhost.auth.url).toBe('http://localhost:1337/v1/auth')
      expect(nhost.storage.url).toBe('http://localhost:1337/v1/storage')
      expect(nhost.graphql.httpUrl).toBe('http://localhost:1337/v1/graphql')
      expect(nhost.functions.url).toBe('http://localhost:1337/v1/functions')
    })
  })
})
