import { exec } from 'child_process'
import fetch from 'cross-fetch'
import { promisify } from 'util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const promisifiedExec = promisify(exec)

describe(
  'docker-compose should start, work and stop',
  () => {
    beforeAll(async () => {
      // * Start docker compose
      await promisifiedExec(
        'docker compose -f docker-compose.yaml --env-file .env.example up --wait --quiet-pull'
      )
    }, 5 * 60 * 1000)

    afterAll(async () => {
      // * Stop docker compose
      await promisifiedExec('docker compose -f docker-compose.yaml --env-file .env.example down')
    }, 5 * 60 * 1000)

    it(
      'Hasura',
      async () => {
        await expect(
          fetch('http://localhost:1337/healthz').then((res) => res.status)
        ).resolves.toEqual(200)
      },
      { retry: 60, timeout: 1000 }
    )

    it(
      'Hasura auth',
      async () => {
        await expect(
          fetch('http://localhost:1337/v1/auth/healthz').then((res) => res.status)
        ).resolves.toEqual(200)
      },
      { retry: 60, timeout: 1000 }
    )

    it(
      'Hasura storage',
      async () => {
        await expect(
          fetch('http://localhost:1337/v1/storage/version').then((res) => res.status)
        ).resolves.toEqual(200)
      },
      { retry: 60, timeout: 1000 }
    )

    it(
      'Serverless functions',
      async () => {
        await expect(
          fetch('http://localhost:1337/v1/functions/hello').then((res) => res.status)
        ).resolves.toEqual(200)
      },
      { retry: 60, timeout: 1000 }
    )

    it(
      'Dashboard',
      async () => {
        await expect(fetch('http://localhost:3030').then((res) => res.status)).resolves.toEqual(200)
      },
      { retry: 60, timeout: 1000 }
    )
  },
  { timeout: 5 * 60 * 1000 }
)
