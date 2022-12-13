export type StorageGetter = (key: string) => string | null | Promise<string | null>
export type StorageSetter = (key: string, value: string | null) => void | Promise<void>

export interface ClientStorage {
  // custom
  // localStorage
  // AsyncStorage
  // https://react-native-community.github.io/async-storage/docs/usage
  setItem?: (_key: string, _value: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getItem?: (key: string) => any
  removeItem?: (key: string) => void

  // capacitor
  set?: (options: { key: string; value: string }) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get?: (options: { key: string }) => any
  remove?: (options: { key: string }) => void

  // expo-secure-storage
  setItemAsync?: (key: string, value: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getItemAsync?: (key: string) => any
  deleteItemAsync?: (key: string) => void
  customGet?: (key: string) => Promise<string | null> | string | null
  customSet?: (key: string, value: string | null) => Promise<void> | void
}

// supported client storage types
export type ClientStorageType =
  | 'capacitor'
  | 'custom'
  | 'expo-secure-storage'
  | 'localStorage'
  | 'react-native'
  | 'web'
  | 'cookie'
