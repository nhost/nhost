import { interpret, InterpreterFrom } from 'xstate'

import { createNhostMachine, NhostInitOptions, NhostMachine } from './machines'
import { defaultStorageGetter, defaultStorageSetter } from './storage'

export * from './constants'

export type NhostInterpreter = InterpreterFrom<NhostMachine>
export type Nhost = {
  backendUrl: string
  interpreter: NhostInterpreter
}
export type { NhostMachine }
let _nhost: Nhost | null
export const getNhost = () => _nhost

export const initNhost = ({
  backendUrl,
  storageGetter = defaultStorageGetter,
  storageSetter = defaultStorageSetter,
  ssr = false
}: NhostInitOptions): Nhost => {
  const machine = createNhostMachine({ backendUrl, storageGetter, storageSetter, ssr })
  const interpreter = interpret(machine)
  interpreter.start()
  const nhost = {
    interpreter,
    backendUrl
  }
  _nhost = nhost
  return nhost
}
