import {
  AuthContext,
  defaultClientStorageGetter,
  defaultClientStorageSetter,
  StorageGetter,
  StorageSetter
} from '@nhost/core'

import { ClientStorage, ClientStorageType, Session } from './types'

export const isBrowser = () => typeof window !== 'undefined'

export const getSession = (context?: AuthContext): Session | null => {
  if (
    !context ||
    !context.accessToken.value ||
    !context.refreshToken.value ||
    !context.accessToken.expiresAt
  )
    return null
  return {
    accessToken: context.accessToken.value,
    accessTokenExpiresIn: (context.accessToken.expiresAt.getTime() - Date.now()) / 1000,
    refreshToken: context.refreshToken.value,
    user: context.user
  }
}

const checkStorageAccessors = (
  clientStorage: ClientStorage,
  accessors: Array<keyof ClientStorage>
) => {
  accessors.forEach((key) => {
    if (typeof clientStorage[key] !== 'function') {
      console.error(`clientStorage.${key} is not a function`)
    }
  })
}

export const localStorageGetter = (
  clientStorageType: ClientStorageType,
  clientStorage?: ClientStorage
): StorageGetter => {
  if (clientStorage) {
    if (clientStorageType === 'react-native' || clientStorageType === 'custom') {
      checkStorageAccessors(clientStorage, ['getItem'])
      return (key) => clientStorage.getItem?.(key)
    } else if (clientStorageType === 'capacitor') {
      checkStorageAccessors(clientStorage, ['get'])
      return (key) => clientStorage.get?.({ key })
    } else if (clientStorageType === 'expo-secure-storage') {
      checkStorageAccessors(clientStorage, ['getItemAsync'])
      return (key) => clientStorage.getItemAsync?.(key)
    }
  }
  return defaultClientStorageGetter
}

export const localStorageSetter = (
  clientStorageType: ClientStorageType,
  clientStorage?: ClientStorage
): StorageSetter => {
  if (clientStorage) {
    if (clientStorageType === 'react-native' || clientStorageType === 'custom') {
      checkStorageAccessors(clientStorage, ['setItem', 'removeItem'])

      return (key, value) => {
        if (value) clientStorage.setItem?.(key, value)
        else clientStorage.removeItem?.(key)
      }
    } else if (clientStorageType === 'capacitor') {
      checkStorageAccessors(clientStorage, ['set', 'remove'])
      return (key, value) => {
        if (value) clientStorage.set?.({ key, value })
        else clientStorage.remove?.({ key })
      }
    } else if (clientStorageType === 'expo-secure-storage') {
      checkStorageAccessors(clientStorage, ['setItemAsync', 'deleteItemAsync'])
      return async (key, value) => {
        if (value) await clientStorage.setItemAsync?.(key, value)
        else clientStorage.deleteItemAsync?.(key)
      }
    }
  }

  return defaultClientStorageSetter
}
