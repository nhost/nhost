import { createNhostMachine, NhostInitOptions, NhostMachine } from './machines'
import { defaultStorageGetter, defaultStorageSetter } from './storage'

export type Nhost = {
  machine: NhostMachine
  backendUrl: string
}
export type { NhostMachine }

export const initNhost = ({
  backendUrl,
  storageGetter = defaultStorageGetter,
  storageSetter = defaultStorageSetter
}: NhostInitOptions): Nhost => {
  return {
    backendUrl,
    machine: createNhostMachine({ backendUrl, storageGetter, storageSetter })
  }
}
