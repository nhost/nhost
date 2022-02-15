import Cookies from 'js-cookie'

export type StorageGetter = (key: string, { ssr: boolean }) => string | null
export type StorageSetter = (key: string, value: string | null, { ssr: boolean }) => void
const isBrowser = typeof window !== 'undefined'

// TODO rename to 'refreshTokenGetter' and 'refreshTokenSetter'
export const defaultStorageGetter: StorageGetter = (key, { ssr }) => {
  if (ssr) {
    if (isBrowser) {
      return Cookies.get(key) ?? null
    } else {
      console.warn(
        'Storage getter is not configured to work on the server side on SSR mode. Ignored.'
      )
      return null
    }
  } else {
    if (isBrowser && localStorage) return localStorage.getItem(key)
    else {
      console.warn('no defaultStorageGetter')
      return null
    }
  }
}

export const defaultStorageSetter: StorageSetter = (key, value, { ssr }) => {
  if (ssr) {
    if (isBrowser) {
      if (value) Cookies.set(key, value)
      else Cookies.remove(key)
    } else {
      console.warn(
        'Storage setter is not configured to work on the server side on SSR mode. Ignored.'
      )
    }
  }
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
