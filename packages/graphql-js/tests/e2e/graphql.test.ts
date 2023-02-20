import { faker } from '@faker-js/faker'
import { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { HasuraAuthClient } from '@nhost/hasura-auth-js'
import gql from 'graphql-tag'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NhostGraphqlClient } from '../../src'

const client = new NhostGraphqlClient({
  url: 'http://localhost:1337/v1/graphql'
})

const authClient = new HasuraAuthClient({ url: 'http://localhost:1337/v1/auth' })

type User = { id: string; displayName: string }

describe('main tests', () => {
  it('getUrl()', () => {
    const graphqlUrl = client.getUrl()

    expect(graphqlUrl).toBe('http://localhost:1337/v1/graphql')
  })

  it('httpUrl', async () => {
    const graphqlUrl = client.httpUrl

    expect(graphqlUrl).toBe('http://localhost:1337/v1/graphql')
  })

  it('getWsUrl()', () => {
    const graphqlUrl = client.wsUrl

    expect(graphqlUrl).toBe('ws://localhost:1337/v1/graphql')
  })

  it('GraphQL request as logged out user', async () => {
    const document = `
      query {
        files {
          id
        }
      }
    `
    const { data, error } = await client.request<{ users: User[] }>(document)

    expect(data).toBeNull()
    expect(error).toMatchInlineSnapshot(`
      [
        {
          "extensions": {
            "code": "validation-failed",
            "path": "$.selectionSet.files",
          },
          "message": "field 'files' not found in type: 'query_root'",
        },
      ]
    `)
  })
})

describe('authenticated user', () => {
  beforeAll(async () => {
    const email = faker.internet.email()
    const password = faker.internet.password()

    await authClient.signUp({ email, password })
    client.setAccessToken(authClient.getAccessToken())
  })

  afterAll(async () => {
    await authClient.signOut()
    client.setAccessToken(undefined)
  })

  it('GraphQL with variables', async () => {
    const document = `
      query ($id: uuid!) {
        todos (where: {id: {_eq: $id }}) {
          id
        }
      }
    `
    const { data, error } = await client.request<{ user: User }, { id: string }>(document, {
      id: '5ccdb471-8ab2-4441-a3d1-f7f7146dda0c'
    })

    expect(error).toBeNull()
    expect(data).toBeTruthy()
  })

  it('should work with TypedDocumentNode', async () => {
    const document = gql`
      query ($id: uuid!) {
        todos(where: { id: { _eq: $id } }) {
          id
        }
      }
    ` as TypedDocumentNode<{ user: User }, { id: string }>
    const { data, error } = await client.request<{ user: User }, { id: string }>(document, {
      id: '5ccdb471-8ab2-4441-a3d1-f7f7146dda0c'
    })

    expect(error).toBeNull()
    expect(data).toBeTruthy()
  })

  it('GraphQL with incorrect variables', async () => {
    const document = `
      query ($id: uuid!) {
        user (id: $id) {
          id
          displayName
        }
      }
    `
    const { data, error } = await client.request<{ user: User }, { id: string }>(document, {
      id: 'not-a-uuid'
    })

    expect(error).toMatchInlineSnapshot(`
      [
        {
          "extensions": {
            "code": "data-exception",
            "path": "$",
          },
          "message": "invalid input syntax for type uuid: \\"not-a-uuid\\"",
        },
      ]
    `)
    expect(data).toBeNull()
  })

  it('GraphQL with missing variables', async () => {
    const document = `
      query ($id: uuid!) {
        user (id: $id) {
          id
          displayName
        }
      }
    `
    const { data, error } = await client.request<{ user: User }>(document, {})

    expect(error).toMatchInlineSnapshot(`
      [
        {
          "extensions": {
            "code": "validation-failed",
            "path": "$",
          },
          "message": "expecting a value for non-nullable variable: \\"id\\"",
        },
      ]
    `)
    expect(data).toBeNull()
  })
})

describe('as an admin', () => {
  it('GraphQL request as admin', async () => {
    const document = `
      query {
        users {
          id
          displayName
        }
      }
    `
    const { data, error } = await client.request<{ users: User[] }>(
      document,
      {},
      {
        headers: {
          'x-hasura-admin-secret': 'nhost-admin-secret'
        }
      }
    )

    expect(error).toBeNull()
    expect(data).toBeTruthy()
  })

  it('GraphQL with variables', async () => {
    const document = `
      query ($id: uuid!) {
        user (id: $id) {
          id
          displayName
        }
      }
    `
    const { data, error } = await client.request<{ user: User }, { id: string }>(
      document,
      {
        id: '5ccdb471-8ab2-4441-a3d1-f7f7146dda0c'
      },
      {
        headers: {
          'x-hasura-admin-secret': 'nhost-admin-secret'
        }
      }
    )

    expect(error).toBeNull()
    expect(data).toBeTruthy()
  })

  it('GraphQL with incorrect variables', async () => {
    const document = `
      query ($id: uuid!) {
        user (id: $id) {
          id
          displayName
        }
      }
    `
    const { data, error } = await client.request<{ user: User }, { id: string }>(
      document,
      {
        id: 'not-a-uuid'
      },
      {
        headers: {
          'x-hasura-admin-secret': 'nhost-admin-secret'
        }
      }
    )

    expect(error).toMatchInlineSnapshot(`
      [
        {
          "extensions": {
            "code": "data-exception",
            "path": "$",
          },
          "message": "invalid input syntax for type uuid: \\"not-a-uuid\\"",
        },
      ]
    `)
    expect(data).toBeNull()
  })

  it('GraphQL with missing variables', async () => {
    const document = `
      query ($id: uuid!) {
        user (id: $id) {
          id
          displayName
        }
      }
    `
    const { data, error } = await client.request<{ user: User }>(
      document,
      {},
      {
        headers: {
          'x-hasura-admin-secret': 'nhost-admin-secret'
        }
      }
    )

    expect(error).toMatchInlineSnapshot(`
      [
        {
          "extensions": {
            "code": "validation-failed",
            "path": "$",
          },
          "message": "expecting a value for non-nullable variable: \\"id\\"",
        },
      ]
    `)
    expect(data).toBeNull()
  })
})
