import { NhostClient } from '../src'

const BACKEND_URL = 'http://localhost:1337'

const nhost = new NhostClient({
  backendUrl: BACKEND_URL
})
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
    const { data, error } = await nhost.graphql.request(document)

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
    const { data, error } = await nhost.graphql.request(
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

  it('GraphQL with incorrect variables', async () => {
    const document = `
  query ($id: uuid!) {
    user (id: $id) {
      id
      displayName
    }
  }
    `
    const { data, error } = await nhost.graphql.request(
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
})
