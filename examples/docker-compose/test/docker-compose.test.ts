import { exec } from 'child_process'
import fetch from 'cross-fetch'
import { promisify } from 'util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const promisifiedExec = promisify(exec)
const COMPOSE_FILE = 'docker-compose.yaml'
const ENV_FILE = '.env.example'
const HEALTH_CHECK_TIMEOUT = 1000
const HEALTH_CHECK_RETRY_COUNT = 60

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
          await healthCheck('http://localhost:8080/healthz')
        },
        { retry: HEALTH_CHECK_RETRY_COUNT, timeout: HEALTH_CHECK_TIMEOUT }
      )

      it(
        'Hasura auth',
        async () => {
          await healthCheck('http://localhost:4000/healthz')
        },
        { retry: HEALTH_CHECK_RETRY_COUNT, timeout: HEALTH_CHECK_TIMEOUT }
      )

      it(
        'Hasura storage',
        async () => {
          await healthCheck('http://localhost:4001/version')
        },
        { retry: HEALTH_CHECK_RETRY_COUNT, timeout: HEALTH_CHECK_TIMEOUT }
      )

      it(
        'Serverless functions',
        async () => 
          await healthCheck('http://localhost:4002/hello')
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
  },
  { timeout: 5 * 60 * 1000 }
)
