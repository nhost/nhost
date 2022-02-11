export type StorageGetter = (key: string) => string | null
export type StorageSetter = (key: string, value: string | null) => void

export const defaultStorageGetter: StorageGetter = (key) => {
  if (localStorage) return localStorage.getItem(key)
  else
    throw Error(
      'localStorage is not available and no custom storageGetter has been set as an option'
    )
}

export const defaultStorageSetter: StorageSetter = (key, value) => {
  if (localStorage) {
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
    }
  } else
    throw Error(
      'localStorage is not available and no custom storageSetter has been set as an option'
    )
}
