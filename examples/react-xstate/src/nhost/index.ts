import { NhostMachine, nhostMachineWithConfig, NhostInitOptions } from './machine'
import { defaultStorageGetter, defaultStorageSetter } from './storage'

type Nhost = {
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
    machine: nhostMachineWithConfig({ backendUrl, storageGetter, storageSetter })
  }
}
