import { BroadcastChannel } from 'broadcast-channel'
import { interpret } from 'xstate'

import { AuthMachine, AuthMachineOptions, createAuthMachine } from './machines'
import { defaultStorageGetter, defaultStorageSetter } from './storage'
import type { AuthInterpreter } from './types'

export type NhostClientOptions = AuthMachineOptions & { start?: boolean }

export class AuthClient {
  readonly backendUrl: string
  readonly clientUrl: string
  readonly machine: AuthMachine
  interpreter?: AuthInterpreter
  #channel?: BroadcastChannel

  constructor({
    backendUrl,
    clientUrl = typeof window !== 'undefined' ? window.location.origin : '',
    storageGetter = defaultStorageGetter,
    storageSetter = defaultStorageSetter,
    autoSignIn = true,
    autoRefreshToken = true,
    start = true
  }: NhostClientOptions) {
    this.backendUrl = backendUrl
    this.clientUrl = clientUrl

    this.machine = createAuthMachine({
      backendUrl,
      clientUrl,
      storageGetter,
      storageSetter,
      autoSignIn,
      autoRefreshToken
    })

    if (start) {
      this.interpreter = interpret(this.machine)
      this.interpreter.start()
    }

    if (typeof window !== 'undefined' && autoSignIn) {
      this.#channel = new BroadcastChannel<string>('nhost')
      this.#channel.addEventListener('message', (token) => {
        const existingToken = this.interpreter?.state.context.refreshToken
        if (this.interpreter && token !== existingToken) {
          this.interpreter.send({ type: 'TRY_TOKEN', token })
        }
      })
    }
  }
}
