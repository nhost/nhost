import Cookies from 'js-cookie'

export type StorageGetter = (key: string) => string | null
export type StorageSetter = (key: string, value: string | null) => void
const isBrowser = typeof window !== 'undefined'

// TODO rename to 'refreshTokenGetter' and 'refreshTokenSetter'
export const defaultStorageGetter: StorageGetter = (key) => {
  if (isBrowser && localStorage) return localStorage.getItem(key)
  else {
    console.warn('no defaultStorageGetter')
    return null
  }
}

export const defaultStorageSetter: StorageSetter = (key, value) => {
  if (isBrowser && localStorage) {
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
    }
  } else {
    console.warn('no defaultStorageSetter')
    // throw Error(
    //   'localStorage is not available and no custom storageSetter has been set as an option'
    // )}
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
