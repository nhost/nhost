import { createNhostMachine, NhostContext, NhostInitOptions, NhostMachine } from './machines'
import { defaultStorageGetter, defaultStorageSetter } from './storage'

export * from './constants'

export type Nhost = {
  backendUrl: string
  machine: NhostMachine
}
export type { NhostContext, NhostInitOptions, NhostMachine }

let _nhost: Nhost | null

export const getNhost = () => _nhost

export const initNhost = ({
  backendUrl,
  storageGetter = defaultStorageGetter,
  storageSetter = defaultStorageSetter,
  ssr = false
}: NhostInitOptions): Nhost => {
  const machine = createNhostMachine({
    backendUrl,
    storageGetter,
    storageSetter,
    ssr
  })
  const nhost = {
    machine,
    backendUrl
  }
  _nhost = nhost
  return nhost
}
