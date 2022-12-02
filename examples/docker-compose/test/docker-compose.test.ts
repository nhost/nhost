import { execSync } from 'child_process'
import fetch from 'cross-fetch'
import { expect, it } from 'vitest'

it(
  'docker-compose',
  async () => {
    // * Start the docker-compose
    expect(() => {
      execSync('docker compose -f docker-compose.yaml --env-file .env.example up --wait')
    }).not.toThrowError()

    // * Hasura
    await expect(fetch('http://localhost:1337/healthz').then((res) => res.status)).resolves.toEqual(
      200
    )

    // * Hasura-auth
    await expect(
      fetch('http://localhost:1337/v1/auth/healthz').then((res) => res.status)
    ).resolves.toEqual(200)

    // * Hasura-storage
    await expect(
      fetch('http://localhost:1337/v1/storage/version').then((res) => res.status)
    ).resolves.toEqual(200)

    // * Serverless functions
    await expect(
      fetch('http://localhost:1337/v1/functions/hello').then((res) => res.status)
    ).resolves.toEqual(200)

    // * Dashboard
    await expect(fetch('http://localhost:3030').then((res) => res.status)).resolves.toEqual(200)

    // * Stop the docker-compose
    expect(() => {
      execSync('docker compose -f docker-compose.yaml --env-file .env.example down')
    }).not.toThrowError()
  },
  { timeout: 5 * 60 * 1000 }
)
