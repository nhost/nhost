import { BroadcastChannel } from 'broadcast-channel'
import { interpret, InterpreterFrom } from 'xstate'

import {
  createNhostMachine,
  INITIAL_MACHINE_CONTEXT,
  NhostContext,
  NhostMachine,
  NhostMachineOptions
} from './machines'
import { defaultStorageGetter, defaultStorageSetter } from './storage'

export * from './constants'
export * from './storage'

export type Nhost = {
  backendUrl: string
  machine: NhostMachine
  interpreter?: InterpreterFrom<NhostMachine>
}

export type NhostClientOptions = NhostMachineOptions & { initialContext?: Partial<NhostContext> }
export type { NhostContext, NhostMachine, NhostMachineOptions }
export { INITIAL_MACHINE_CONTEXT }
export class NhostClient {
  readonly backendUrl: string
  readonly machine: NhostMachine
  #interpreter?: InterpreterFrom<NhostMachine>
  #channel?: BroadcastChannel

  constructor({
    initialContext,
    backendUrl,
    storageGetter = defaultStorageGetter,
    storageSetter = defaultStorageSetter,
    autoLogin = true,
    autoRefreshToken = true
  }: NhostClientOptions) {
    this.backendUrl = backendUrl

    const machine = createNhostMachine({
      backendUrl,
      storageGetter,
      storageSetter,
      autoLogin,
      autoRefreshToken
    })

    this.machine = initialContext
      ? machine.withContext({ ...INITIAL_MACHINE_CONTEXT, ...initialContext })
      : machine

    if (autoLogin) {
      this.#channel = new BroadcastChannel<string>('nhost')
      this.#channel.addEventListener('message', (token) => {
        const existingToken = this.#interpreter?.state.context.refreshToken
        if (this.#interpreter && token !== existingToken) {
          this.#interpreter.send({ type: 'TRY_TOKEN', token })
        }
      })
    }
  }

  get interpreter(): InterpreterFrom<NhostMachine> {
    if (!this.#interpreter) {
      const interpreter = interpret(this.machine, {
        devTools: typeof window !== 'undefined' && process.env.NODE_ENV === 'development'
      })
      interpreter.start()
      this.#interpreter = interpreter
    }
    return this.#interpreter
  }

  set interpreter(value: InterpreterFrom<NhostMachine>) {
    if (this.#interpreter) {
      this.#interpreter.stop()
    }
    this.#interpreter = value
  }
}
