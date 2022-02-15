import { InterpreterFrom } from 'xstate'

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

export type NhostInitOptions = NhostMachineOptions & {
  start?: boolean
}

export type Nhost = {
  backendUrl: string
  machine: NhostMachine
  interpreter?: InterpreterFrom<NhostMachine>
}

export type { NhostContext, NhostMachine, NhostMachineOptions }
export { INITIAL_MACHINE_CONTEXT }

let _nhost: Nhost | null

export const getNhost = () => _nhost

export const initNhost = ({
  backendUrl,
  storageGetter = defaultStorageGetter,
  storageSetter = defaultStorageSetter
}: NhostInitOptions): Nhost => {
  const machine = createNhostMachine({
    backendUrl,
    storageGetter,
    storageSetter
  })
  const nhost: Nhost = {
    machine,
    backendUrl
  }
  _nhost = nhost
  return nhost
}
