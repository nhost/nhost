import Cookies from 'js-cookie'

export type StorageGetter = (key: string) => string | null | Promise<string | null>
export type StorageSetter = (key: string, value: string | null) => void | Promise<void>

const isBrowser = typeof window !== 'undefined'

const inMemoryLocalStorage: Map<string, string | null> = new Map()

export const defaultClientStorageGetter: StorageGetter = (key) => {
  if (isBrowser && localStorage) return localStorage.getItem(key)
  else return inMemoryLocalStorage.get(key) ?? null
}

export const defaultClientStorageSetter: StorageSetter = (key, value) => {
  if (isBrowser && localStorage) {
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

export const cookieStorageGetter: StorageGetter = (key) => {
  if (isBrowser) {
    return Cookies.get(key) ?? null
  } else {
    return null
  }
}

export const cookieStorageSetter: StorageSetter = (key, value) => {
  if (isBrowser) {
    if (value) {
      Cookies.set(key, value)
      // localStorage.setItem(key, value)
    } else {
      Cookies.remove(key)
      // localStorage.removeItem(key)
    }
  }
}
