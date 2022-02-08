import { createMachine } from 'xstate'
import produce from 'immer'
import { defaultStorageGetter, defaultStorageSetter, StorageGetter, StorageSetter } from './storage'
import { INTIAL_CONTEXT, NhostContext } from './context'
import { NHOST_REFRESH_TOKEN } from './constants'
import { createBackendServices } from './backend-services'
import { tokenActions, tokenConfig, tokenGuards } from './token'
import { authenticationActions, authenticationConfig, authenticationGuards } from './authentication'
import { inputsActions, inputsGuards } from './inputs'

export type NhostMachineOptions = {
  backendUrl: string
  storageGetter?: StorageGetter
  storageSetter?: StorageSetter
}

export type NhostMachine = ReturnType<typeof createNhostMachine>

export const createNhostMachine = ({
  backendUrl,
  storageGetter = defaultStorageGetter,
  storageSetter = defaultStorageSetter
}: NhostMachineOptions) => {
  return createMachine<NhostContext>(
    {
      id: 'nhost',
      type: 'parallel',
      context: produce(INTIAL_CONTEXT, (ctx) => {
        ctx.refreshToken.value = storageGetter(NHOST_REFRESH_TOKEN)
      }),
      states: {
        ...authenticationConfig,
        ...tokenConfig
      }
    },
    {
      // TODO type events in actions
      actions: {
        ...authenticationActions,
        ...tokenActions(storageSetter),
        ...inputsActions
      },
      // TODO type events in guards
      guards: {
        ...authenticationGuards,
        ...tokenGuards,
        ...inputsGuards
      },
      services: createBackendServices(backendUrl)
    }
  )
}
