import { exec } from 'child_process'
import fetch from 'cross-fetch'
import { promisify } from 'util'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { NhostClient } from '@nhost/nhost-js'
import { gql } from 'graphql'

const promisifiedExec = promisify(exec)
const COMPOSE_FILE = 'docker-compose.yaml'
const ENV_FILE = '.env.example'
const HEALTH_CHECK_TIMEOUT = 1000
const HEALTH_CHECK_RETRY_COUNT = 60

const HASURA_URL = 'http://localhost:8080'
const GRAPHQL_URL = `${HASURA_URL}/v1/graphql`
const AUTH_URL = 'http://localhost:4000'
const STORAGE_URL = 'http://localhost:4001'
const FUNCTIONS_URL = 'http://localhost:4002'

const nhost = new NhostClient({
  graphqlUrl: GRAPHQL_URL,
  authUrl: AUTH_URL,
  storageUrl: STORAGE_URL,
  functionsUrl: FUNCTIONS_URL,
  adminSecret: 'nhost-admin-secret'
})

const healthCheck = async (url: string) => {
  const response = await fetch(url)
  expect(response.status).toEqual(200)
}

describe(
  'docker-compose should start, work and stop',
  () => {
    beforeAll(async () => {
      await promisifiedExec(
        `docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up --wait --quiet-pull`
      )
    }, 5 * 60 * 1000)

    afterAll(async () => {
      await promisifiedExec(`docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} down`)
    }, 5 * 60 * 1000)

    describe('health checks', () => {
      it(
        'Hasura',
        async () => {
          await healthCheck(`${HASURA_URL}/healthz`)
        },
        { retry: HEALTH_CHECK_RETRY_COUNT, timeout: HEALTH_CHECK_TIMEOUT }
      )

      it(
        'Hasura auth',
        async () => {
          await healthCheck(`${AUTH_URL}/healthz`)
        },
        { retry: HEALTH_CHECK_RETRY_COUNT, timeout: HEALTH_CHECK_TIMEOUT }
      )

      it(
        'Hasura storage',
        async () => {
          await healthCheck(`${STORAGE_URL}/healthz`)
        },
        { retry: HEALTH_CHECK_RETRY_COUNT, timeout: HEALTH_CHECK_TIMEOUT }
      )

      it(
        'Serverless functions',
        async () => {
          await healthCheck(`${FUNCTIONS_URL}/hello`)
        },
        { retry: HEALTH_CHECK_RETRY_COUNT, timeout: HEALTH_CHECK_TIMEOUT }
      )

      it(
        'Dashboard',
        async () => {
          await healthCheck('http://localhost:3030')
        },
        { retry: HEALTH_CHECK_RETRY_COUNT, timeout: HEALTH_CHECK_TIMEOUT }
      )
    })

    describe('Nhost SDK', () => {
      beforeEach(async () => {
        // send mutation that deletes all users
        await nhost.graphql.request(
          `# graphql
            mutation DeleteAllUsers {
              deleteUsers(where: {}) {
                affected_rows
              }
            }
          `
        )
      })

      it('should register a new user', async () => {
        const { error } = await nhost.auth.signUp({
          email: 'joe@example.co',
          password: 'password'
        })
        expect(error).toBeNull()
      })

      it('should send a successful graphql request', async () => {
        const { error } = await nhost.graphql.request(`
          query {
            users {
              id
            }
          }
        `)
        expect(error).toBeNull()
      })

      it('should send a successful call to a function', async () => {
        const { error } = await nhost.functions.call('hello', { name: 'Joe' })
        expect(error).toBeNull()
      })
    })
  },
  { timeout: 5 * 60 * 1000 }
)
