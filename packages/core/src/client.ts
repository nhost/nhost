import { BroadcastChannel } from 'broadcast-channel'
import { interpret, InterpreterFrom } from 'xstate'

import { createNhostMachine, NhostMachine, NhostMachineOptions } from './machines'
import { defaultStorageGetter, defaultStorageSetter } from './storage'

export type NhostClientOptions = NhostMachineOptions & { start?: boolean }

export class Nhost {
  readonly backendUrl: string
  readonly clientUrl: string
  readonly machine: NhostMachine
  interpreter?: InterpreterFrom<NhostMachine>
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

    this.machine = createNhostMachine({
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
