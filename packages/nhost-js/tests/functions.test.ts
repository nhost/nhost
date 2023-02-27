import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { urlFromSubdomain } from '../src/utils/helpers'
import { createFunctionsClient, NhostFunctionsClient } from '../src/clients/functions'

describe('createFunctionsClient', () => {
  it('should throw an error if neither subdomain nor functionsUrl are provided', () => {
    expect(() => {
      createFunctionsClient({})
    }).toThrow()
  })

  it('should throw an error if a non localhost subdomain is used without a region', () => {
    const subdomain = 'test-subdomain'
    expect(() => {
      createFunctionsClient({ subdomain })
    }).toThrow()
  })

  it('should create a client with localhost as a subdomain without a region subdomain', () => {
    const subdomain = 'localhost'
    const client = createFunctionsClient({ subdomain })

    expect(client).toBeInstanceOf(NhostFunctionsClient)
    expect(client.url).toEqual(urlFromSubdomain({ subdomain }, 'functions'))
  })

  it('should create a client with non localhost subdomain and any region', () => {
    const subdomain = 'localhost'
    const region = 'eu-central-1'
    const client = createFunctionsClient({ subdomain, region })

    expect(client).toBeInstanceOf(NhostFunctionsClient)
    expect(client.url).toEqual(urlFromSubdomain({ subdomain, region }, 'functions'))
  })

  it('should create a client with functionsUrl', () => {
    const functionsUrl = 'http://test-functions-url'
    const client = createFunctionsClient({ functionsUrl })

    expect(client).toBeInstanceOf(NhostFunctionsClient)
    expect(client.url).toEqual(functionsUrl)
  })
})

describe('NhostFunctionsClient', () => {
  let client: NhostFunctionsClient

  beforeEach(() => {
    client = new NhostFunctionsClient({ url: 'http://test-url' })
  })

  it('should set the access token', () => {
    const accessToken = 'test-access-token'

    client.setAccessToken(accessToken)

    expect(client.generateAccessTokenHeaders()).toEqual({
      Authorization: `Bearer ${accessToken}`
    })
  })

  it('should clear the access token', () => {
    const accessToken = 'test-access-token'

    client.setAccessToken(accessToken)
    client.setAccessToken(undefined)

    expect(client.generateAccessTokenHeaders()).toEqual({})
  })

  it('should generate headers with admin secret', () => {
    const adminSecret = 'test-admin-secret'
    const clientWithAdminSecret = new NhostFunctionsClient({ url: 'http://test-url', adminSecret })

    expect(clientWithAdminSecret.generateAccessTokenHeaders()).toEqual({
      'x-hasura-admin-secret': adminSecret
    })
  })
})
