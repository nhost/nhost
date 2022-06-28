import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { createFileUploadMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/file-upload.typegen'
import { BASE_URL } from './helpers/config'
import { uploadFiledNetworkErrorHandler } from './helpers/handlers'
import server from './helpers/server'
import { clientStorage } from './helpers/storage'
import { GeneralFileUploadState } from './helpers/types'
import { createAuthMachine } from '@nhost/core'

type FileUploadState = GeneralFileUploadState<Typegen0>

// TODO complete tests when MSW supports upload events
// ! https://github.com/mswjs/interceptors/issues/187

const auth = interpret(
  createAuthMachine({
    backendUrl: BASE_URL + '/v1/auth',
    clientUrl: 'http://localhost:3000',
    autoRefreshToken: false,
    autoSignIn: false,
    clientStorageType: 'custom',
    clientStorage
  })
)

const fileUploadMachine = createFileUploadMachine()

const fileUploadService = interpret(fileUploadMachine)

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' })
  await waitFor(auth.start(), (state) => state.matches('authentication.signedIn'))
})
afterAll(() => server.close())

beforeEach(() => {
  fileUploadService.start()
})

afterEach(() => {
  fileUploadService.stop()
  server.resetHandlers()
})

test.skip(`should fail if there is a network error`, async () => {
  server.use(uploadFiledNetworkErrorHandler)

  const file = new File([], 'test.txt')
  fileUploadService.send({
    type: 'UPLOAD',
    url: BASE_URL + '/v1/storage',
    file,
    id: undefined,
    bucketId: undefined,
    name: undefined
  })
  const state: FileUploadState = await waitFor(fileUploadService, (state: FileUploadState) =>
    state.matches('error')
  )
  // ! this test is deactivated and incomplete because msw does not support upload progress events
  // TODO https://github.com/mswjs/interceptors/issues/187
  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "OK",
      "message": "Network Error",
      "status": 200,
    }
  `)
})
