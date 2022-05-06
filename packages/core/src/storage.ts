import Cookies from 'js-cookie'

import { ClientStorage, ClientStorageType } from './types'
export type StorageGetter = (key: string) => string | null | Promise<string | null>
export type StorageSetter = (key: string, value: string | null) => void | Promise<void>

const isBrowser = typeof window !== 'undefined'

const inMemoryLocalStorage: Map<string, string | null> = new Map()

const defaultClientStorageGetter: StorageGetter = (key) => {
  if (isBrowser && typeof localStorage !== 'undefined') return localStorage.getItem(key)
  else return inMemoryLocalStorage.get(key) ?? null
}

const defaultClientStorageSetter: StorageSetter = (key, value) => {
  if (isBrowser && typeof localStorage !== 'undefined') {
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
    }
  } else {
    if (value) {
      inMemoryLocalStorage.set(key, value)
    } else if (inMemoryLocalStorage.has(key)) {
      inMemoryLocalStorage.delete(key)
    }
  }
}

// TODO see https://github.com/nhost/nhost/pull/507#discussion_r865873389
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  if (clientStorageType === 'localStorage' || clientStorageType === 'web') {
    return defaultClientStorageGetter
  }
  if (clientStorageType === 'cookie') {
    return (key) => {
      if (isBrowser) {
        return Cookies.get(key) ?? null
      } else {
        return null
      }
    }
  }

  if (clientStorage) {
    if (clientStorageType === 'react-native') {
      // checkStorageAccessors(clientStorage, ['getItem'])
      return (key) => clientStorage.getItem?.(key)
    }
    if (clientStorageType === 'capacitor') {
      // checkStorageAccessors(clientStorage, ['get'])
      return (key) => clientStorage.get?.({ key })
    }
    if (clientStorageType === 'expo-secure-storage') {
      // checkStorageAccessors(clientStorage, ['getItemAsync'])
      return (key) => clientStorage.getItemAsync?.(key)
    }
    if (clientStorageType === 'custom') {
      if (clientStorage.getItem && clientStorage.removeItem) {
        return clientStorage.getItem
      }
      if (clientStorage.getItemAsync) {
        return clientStorage.getItemAsync
      }
      throw Error(
        `clientStorageType is set to 'custom' but clientStorage is missing getItem or getItemAsync property`
      )
    }
    throw Error(`Unknown storage type: ${clientStorageType}`)
  } else {
    throw Error(
      `clientStorageType is set to '${clientStorageType}' but no clienStorage has been given`
    )
  }
}

export const localStorageSetter = (
  clientStorageType: ClientStorageType,
  clientStorage?: ClientStorage
): StorageSetter => {
  if (clientStorageType === 'localStorage' || clientStorageType === 'web') {
    return defaultClientStorageSetter
  }
  if (clientStorageType === 'cookie') {
    return (key, value) => {
      if (isBrowser) {
        if (value) {
          Cookies.set(key, value)
        } else {
          Cookies.remove(key)
        }
      }
    }
  }
  if (clientStorage) {
    if (clientStorageType === 'react-native') {
      // checkStorageAccessors(clientStorage, ['setItem', 'removeItem'])
      return (key, value) =>
        value ? clientStorage.setItem?.(key, value) : clientStorage.removeItem?.(key)
    }
    if (clientStorageType === 'capacitor') {
      // checkStorageAccessors(clientStorage, ['set', 'remove'])
      return (key, value) =>
        value ? clientStorage.set?.({ key, value }) : clientStorage.remove?.({ key })
    }
    if (clientStorageType === 'expo-secure-storage') {
      // checkStorageAccessors(clientStorage, ['setItemAsync', 'deleteItemAsync'])
      return async (key, value) =>
        value ? clientStorage.setItemAsync?.(key, value) : clientStorage.deleteItemAsync?.(key)
    }
    if (clientStorageType === 'custom') {
      if (!clientStorage.removeItem) {
        throw Error(
          `clientStorageType is set to 'custom' but clientStorage is missing a removeItem property`
        )
      }
      if (clientStorage.setItem) {
        return (key, value) =>
          value ? clientStorage.setItem?.(key, value) : clientStorage.removeItem?.(key)
      }
      if (clientStorage.setItemAsync) {
        return async (key, value) =>
          value ? clientStorage.setItemAsync?.(key, value) : clientStorage.removeItem?.(key)
      }
      throw Error(
        `clientStorageType is set to 'custom' but clientStorage is missing setItem or setItemAsync property`
      )
    }
    throw Error(`Unknown storage type: ${clientStorageType}`)
  } else {
    throw Error(
      `clientStorageType is set to '${clientStorageType}' but no clienStorage has been given`
    )
  }
}
