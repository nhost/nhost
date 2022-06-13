import faker from '@faker-js/faker'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createFileUploadMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/file-upload.typegen'
import { BASE_URL } from './helpers/config'
import {
  resetPasswordInternalErrorHandler,
  resetPasswordNetworkErrorHandler,
  resetPasswordUserNotFoundHandler
} from './helpers/handlers'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'
import { GeneralFileUploadState } from './helpers/types'
import { createAuthMachine } from '@nhost/core'
type FileUploadState = GeneralFileUploadState<Typegen0>

const clientStorage = new CustomClientStorage(new Map())

const fileUploadMachine = createFileUploadMachine({
  url: BASE_URL + '/v1/storage',
  auth: interpret(
    createAuthMachine({
      backendUrl: BASE_URL + '/v1/auth',
      clientUrl: 'http://localhost:3000',
      autoRefreshToken: false,
      autoSignIn: false,
      clientStorageType: 'custom',
      clientStorage
    })
  )
})

const fileUploadService = interpret(fileUploadMachine)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(() => {
  fileUploadService.start()
})

afterEach(() => {
  fileUploadService.stop()
  clientStorage.clear()
  server.resetHandlers()
})

// TODO
test.skip(`should fail if there is a network error`, async () => {
  server.use(resetPasswordNetworkErrorHandler)
  // TODO
  const file = new File([], 'test.txt')
  fileUploadService.send({
    type: 'UPLOAD',
    file,
    id: undefined,
    bucketId: undefined,
    name: undefined
  })

  const state: FileUploadState = await waitFor(fileUploadService, (state: FileUploadState) =>
    state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "OK",
      "message": "Network Error",
      "status": 200,
    }
  `)
})

// TODO
test.skip(`should fail if server returns an error`, async () => {
  server.use(resetPasswordInternalErrorHandler)

  fileUploadService.send({
    type: 'REQUEST',
    email: faker.internet.email()
  })

  const state: FileUploadState = await waitFor(fileUploadService, (state: FileUploadState) =>
    state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "internal-error",
      "message": "Internal error",
      "status": 500,
    }
  `)
})

// TODO
test.skip(`should fail if email is invalid`, async () => {
  fileUploadService.send({
    type: 'REQUEST',
    email: faker.internet.userName()
  })

  const state: FileUploadState = await waitFor(fileUploadService, (state: FileUploadState) =>
    state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchObject(INVALID_EMAIL_ERROR)
})

// TODO
test.skip(`should fail if user is not found`, async () => {
  server.use(resetPasswordUserNotFoundHandler)

  fileUploadService.send({
    type: 'REQUEST',
    email: faker.internet.email()
  })

  const state: FileUploadState = await waitFor(fileUploadService, (state: FileUploadState) =>
    state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "user-not-found",
      "message": "No user found",
      "status": 400,
    }
  `)
})

// TODO
test.skip(`should succeed if email is valid`, async () => {
  fileUploadService.send({ type: 'REQUEST', email: faker.internet.email() })

  const state: FileUploadState = await waitFor(fileUploadService, (state: FileUploadState) =>
    state.matches({ idle: 'success' })
  )

  expect(state.context.error).toBeNull()
})
