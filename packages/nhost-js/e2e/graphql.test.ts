import { faker } from '@faker-js/faker'
import { TypedDocumentNode } from '@graphql-typed-document-node/core'
import gql from 'graphql-tag'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NhostClient } from '../src'

const nhost = new NhostClient({
  subdomain: 'localhost'
})

type User = { id: string; displayName: string }

describe('main tests', () => {
  it('getUrl()', () => {
    const graphqlUrl = nhost.graphql.getUrl()

    expect(graphqlUrl).toBe('http://localhost:1337/v1/graphql')
  })

  it('httpUrl', async () => {
    const graphqlUrl = nhost.graphql.httpUrl

    expect(graphqlUrl).toBe('http://localhost:1337/v1/graphql')
  })

  it('getWsUrl()', () => {
    const graphqlUrl = nhost.graphql.wsUrl

    expect(graphqlUrl).toBe('ws://localhost:1337/v1/graphql')
  })

  it('GraphQL request as logged out user', async () => {
    const document = `
      query {
        users {
          id
          displayName
        }
      }
    `
    const { data, error } = await nhost.graphql.request<{ users: User[] }>(document)

    expect(data).toBeNull()
    expect(error).toMatchInlineSnapshot(`
      [
        {
          "extensions": {
            "code": "validation-failed",
            "path": "$.selectionSet.users",
          },
          "message": "field 'users' not found in type: 'query_root'",
        },
      ]
    `)
  })
})

describe('authenticated user', () => {
  beforeAll(async () => {
    const email = faker.internet.email()
    const password = faker.internet.password()
    await nhost.auth.signUp({ email, password })
  })

  afterAll(async () => {
    await nhost.auth.signOut()
  })

  it('GraphQL with variables', async () => {
    const document = `
      query ($id: uuid!) {
        test (where: {id: {_eq: $id }}) {
          id
        }
      }
    `
    const { data, error } = await nhost.graphql.request<{ user: User }, { id: string }>(document, {
      id: '5ccdb471-8ab2-4441-a3d1-f7f7146dda0c'
    })

    expect(error).toBeNull()
    expect(data).toBeTruthy()
  })

  it('should work with TypedDocumentNode', async () => {
    const document = gql`
      query ($id: uuid!) {
        test(where: { id: { _eq: $id } }) {
          id
        }
      }
    ` as TypedDocumentNode<{ user: User }, { id: string }>
    const { data, error } = await nhost.graphql.request<{ user: User }, { id: string }>(document, {
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
    const { data, error } = await nhost.graphql.request<{ user: User }, { id: string }>(document, {
      id: 'not-a-uuid'
    })

    expect(error).toMatchInlineSnapshot(`
      [
        {
          "extensions": {
            "code": "validation-failed",
            "path": "$.selectionSet.user",
          },
          "message": "field 'user' not found in type: 'query_root'",
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
    const { data, error } = await nhost.graphql.request<{ user: User }>(document, {})

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
    const { data, error } = await nhost.graphql.request<{ users: User[] }>(
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
    const { data, error } = await nhost.graphql.request<{ user: User }, { id: string }>(
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
    const { data, error } = await nhost.graphql.request<{ user: User }, { id: string }>(
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
    const { data, error } = await nhost.graphql.request<{ user: User }>(
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
