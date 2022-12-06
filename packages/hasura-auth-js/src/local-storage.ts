import Cookies from 'js-cookie'

import { ClientStorage, ClientStorageType, StorageGetter, StorageSetter } from './types'

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
  if (!clientStorage) {
    throw Error(
      `clientStorageType is set to '${clientStorageType}' but no clientStorage has been given`
    )
  }
  if (clientStorageType === 'react-native') {
    return (key) => clientStorage.getItem?.(key)
  }
  if (clientStorageType === 'capacitor') {
    return (key) => clientStorage.get?.({ key })
  }
  if (clientStorageType === 'expo-secure-storage') {
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
      `clientStorageType is set to 'custom' but clientStorage is missing either "getItem" and "removeItem" properties or "getItemAsync" property`
    )
  }
  throw Error(`Unknown storage type: ${clientStorageType}`)
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
          // TODO: Set expires based on the actual refresh token expire time
          // For now, we're using 30 days so the cookie is not removed when the browser is closed because if `expiers` is omitted, the cookie becomes a session cookie.
          Cookies.set(key, value, { expires: 30, sameSite: 'lax', httpOnly: false })
        } else {
          Cookies.remove(key)
        }
      }
    }
  }
  if (!clientStorage) {
    throw Error(
      `clientStorageType is set to '${clientStorageType}' but no clienStorage has been given`
    )
  }
  if (clientStorageType === 'react-native') {
    return (key, value) =>
      value ? clientStorage.setItem?.(key, value) : clientStorage.removeItem?.(key)
  }
  if (clientStorageType === 'capacitor') {
    return (key, value) =>
      value ? clientStorage.set?.({ key, value }) : clientStorage.remove?.({ key })
  }
  if (clientStorageType === 'expo-secure-storage') {
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
}
