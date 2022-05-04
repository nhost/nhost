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
    if (clientStorageType === 'react-native') {
      checkStorageAccessors(clientStorage, ['getItem'])
      return (key) => clientStorage.getItem?.(key)
    } else if (clientStorageType === 'capacitor') {
      checkStorageAccessors(clientStorage, ['get'])
      return (key) => clientStorage.get?.({ key })
    } else if (clientStorageType === 'expo-secure-storage') {
      checkStorageAccessors(clientStorage, ['getItemAsync'])
      return (key) => clientStorage.getItemAsync?.(key)
    } else if (clientStorageType === 'cookie') {
      return async (key) => {
        if (isBrowser) {
          const { default: Cookies } = await import('js-cookie')
          return Cookies.get(key) ?? null
        } else {
          return null
        }
      }
    } else if (clientStorageType === 'custom') {
      if (clientStorage.getItem && clientStorage.removeItem) {
        return clientStorage.getItem
      } else if (clientStorage.getItemAsync) {
        return clientStorage.getItemAsync
      } else {
        console.warn(
          `clientStorageType is set to 'custom' but clientStorage is missing getItem or getItemAsync property`
        )
      }
    }
  }
  return defaultClientStorageGetter
}

export const localStorageSetter = (
  clientStorageType: ClientStorageType,
  clientStorage?: ClientStorage
): StorageSetter => {
  if (clientStorage) {
    if (clientStorageType === 'react-native') {
      checkStorageAccessors(clientStorage, ['setItem', 'removeItem'])
      return (key, value) =>
        value ? clientStorage.setItem?.(key, value) : clientStorage.removeItem?.(key)
    } else if (clientStorageType === 'capacitor') {
      checkStorageAccessors(clientStorage, ['set', 'remove'])
      return (key, value) =>
        value ? clientStorage.set?.({ key, value }) : clientStorage.remove?.({ key })
    } else if (clientStorageType === 'expo-secure-storage') {
      checkStorageAccessors(clientStorage, ['setItemAsync', 'deleteItemAsync'])
      return async (key, value) =>
        value ? clientStorage.setItemAsync?.(key, value) : clientStorage.deleteItemAsync?.(key)
    } else if (clientStorageType === 'cookie') {
      return async (key, value) => {
        if (isBrowser) {
          const { default: Cookies } = await import('js-cookie')
          if (value) {
            Cookies.set(key, value)
          } else {
            Cookies.remove(key)
          }
        }
      }
    } else if (clientStorageType === 'custom') {
      if (!clientStorage.removeItem) {
        console.warn(
          `clientStorageType is set to 'custom' but clientStorage is missing a removeItem property`
        )
      }
      if (clientStorage.setItem) {
        return (key, value) =>
          value ? clientStorage.setItem?.(key, value) : clientStorage.removeItem?.(key)
      } else if (clientStorage.setItemAsync) {
        return async (key, value) =>
          value ? clientStorage.setItemAsync?.(key, value) : clientStorage.removeItem?.(key)
      } else {
        console.warn(
          `clientStorageType is set to 'custom' but clientStorage is missing setItem or setItemAsync property`
        )
      }
    }
  }
  return defaultClientStorageSetter
}
