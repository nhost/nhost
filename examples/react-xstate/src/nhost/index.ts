import { produce } from 'immer'
import { NhostInitOptions, nhostMachineWithConfig } from './config'
import { NHOST_REFRESH_TOKEN } from './constants'
import { INITIAL_CONTEXT } from './context'
import { NhostMachine } from './machine'
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
    machine: nhostMachineWithConfig({ backendUrl, storageGetter, storageSetter }).withContext(
      produce(INITIAL_CONTEXT, (ctx) => {
        ctx.refreshToken.value = storageGetter(NHOST_REFRESH_TOKEN)
      })
    )
  }
}
