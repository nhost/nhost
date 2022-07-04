import { describe, expect, it } from 'vitest'

import { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { parse } from 'graphql'

import { NhostClient } from '../src'

const nhost = new NhostClient({
  subdomain: 'localhost:1337'
})

type User = { id: string; displayName: string }

describe('main tests', () => {
  it('getUrl()', async () => {
    const graphqlUrl = await nhost.graphql.getUrl()

    expect(graphqlUrl).toBe('http://localhost:1337/v1/graphql')
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

    expect(error).toBeTruthy()
    expect(data).toBeNull()
  })

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

    expect(error).toBeTruthy()
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

    expect(error).toBeTruthy()
    expect(data).toBeNull()
  })

  it('GraphQL client works with TypedDocumentNode', async () => {
    const document: TypedDocumentNode<{ user: User }, Record<any, never>> = parse(/* GraphQL */ `
      query ($id: uuid!) {
        user(id: $id) {
          id
          displayName
        }
      }
    `)

    const { data, error } = await nhost.graphql.request(
      document,
      {},
      {
        headers: {
          'x-hasura-admin-secret': 'nhost-admin-secret'
        }
      }
    )

    expect(error).toBeTruthy()
    expect(data).toBeNull()
  })

  it('GraphQL client works with TypedDocumentNode and variables', async () => {
    const document: TypedDocumentNode<{ user: User }, { id: string } | Record<any, never>> =
      parse(/* GraphQL */ `
        query ($id: uuid!) {
          user(id: $id) {
            id
            displayName
          }
        }
      `)

    const { data, error } = await nhost.graphql.request(
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
})
