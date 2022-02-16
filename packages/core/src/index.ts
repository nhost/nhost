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

export type NhostInitOptions = { start?: boolean } & NhostMachineOptions

export type Nhost = {
  backendUrl: string
  machine: NhostMachine
  interpreter?: InterpreterFrom<NhostMachine>
}

export type { NhostContext, NhostMachine, NhostMachineOptions }
export { INITIAL_MACHINE_CONTEXT }

let _nhost: Nhost | null

export const getNhostClient = () => _nhost

/**
 * Creates a Nhost client. By default, the internal state is not started, as it should usually be done
 * inside the context of a specific framework e.g. React or Vue.
 * @param param0
 * @returns
 */
export const initNhost = ({
  backendUrl,
  storageGetter = defaultStorageGetter,
  storageSetter = defaultStorageSetter,
  autoLogin = true,
  autoRefreshToken = true,
  start = false
}: NhostInitOptions): Nhost => {
  const machine = createNhostMachine({
    backendUrl,
    storageGetter,
    storageSetter,
    autoLogin,
    autoRefreshToken
  })
  const nhost: Nhost = {
    machine,
    backendUrl
  }
  if (start) {
    nhost.interpreter = interpret(machine)
    nhost.interpreter?.start()
  }
  if (autoLogin) {
    const channel = new BroadcastChannel<string>('nhost')
    channel.addEventListener('message', (token) => {
      const existingToken = nhost.interpreter?.state.context.refreshToken
      if (nhost.interpreter && token !== existingToken) {
        nhost.interpreter.send({ type: 'TRY_TOKEN', token })
      }
    })
  }
  _nhost = nhost
  return nhost
}

/**
 * Generic Nhost client. Instanciates the internal state
 * @param options
 * @returns
 */
export const nhostClient = (options: NhostMachineOptions) => initNhost({ ...options, start: true })
