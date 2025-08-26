import { NhostSession, Provider } from './hasura-auth'
import { ClientStorage, ClientStorageType, StorageGetter, StorageSetter } from './local-storage'
import {
  CommonProviderOptions,
  PasswordlessOptions,
  RedirectOption,
  SignUpOptions,
  SignUpSecurityKeyOptions,
  WorkOsOptions
} from './options'

// Sign Up
export interface CommonSignUpParams {
  options?: SignUpOptions
}

export interface SignUpEmailPasswordParams extends CommonSignUpParams {
  email: string
  password: string
}

export interface SignUpSecurityKeyParams extends CommonSignUpParams {
  email: string
  options?: SignUpSecurityKeyOptions
  securityKey: true
}

export type SignUpParams = SignUpEmailPasswordParams | SignUpSecurityKeyParams
export interface SignInEmailPasswordParams {
  email: string
  password: string
}

export interface SignInEmailPasswordOtpParams {
  otp: string
  ticket?: string
}

export interface SignInPasswordlessEmailParams {
  email: string
  options?: PasswordlessOptions
}

export interface SignInPasswordlessSecurityKeyParams {
  email: string
  securityKey: true
}

export interface SignInPasswordlessSmsParams {
  phoneNumber: string
  options?: PasswordlessOptions
}

export interface SignInPasswordlessSmsOtpParams {
  phoneNumber: string
  otp: string
}

export interface NhostAuthConstructorParams extends AuthOptions {
  url: string
  start?: boolean
  /** @internal @deprecated @alias autoSignIn - use autoSignIn instead  */
  autoLogin?: boolean
}

export type SignInWithProviderParams =
  | { provider: Exclude<Provider, 'workos'>; options?: CommonProviderOptions }
  | { provider: 'workos'; options?: WorkOsOptions }

export type ConnectProviderParams = SignInWithProviderParams

export type LinkIdTokenParams = { provider: Provider; idToken: string; nonce?: string }
export type SignInIdTokenParams = { provider: Provider; idToken: string; nonce?: string }

export type SignInParams =
  | SignInEmailPasswordParams
  | SignInEmailPasswordOtpParams
  | SignInPasswordlessEmailParams
  | SignInPasswordlessSecurityKeyParams
  | SignInPasswordlessSmsOtpParams
  | SignInPasswordlessSmsParams
  | SignInWithProviderParams

export interface ResetPasswordParams {
  email: string
  options?: RedirectOption
}

export interface ChangePasswordParams {
  newPassword: string
  ticket?: string
}

export interface SendVerificationEmailParams {
  email: string
  options?: RedirectOption
}

export interface ChangeEmailParams {
  newEmail: string
  options?: RedirectOption
}

export type DeanonymizeParams =
  | ({
      signInMethod: 'email-password'
    } & SignUpEmailPasswordParams)
  // TODO deanonymise with security key
  | ({
      signInMethod: 'passwordless'
      connection: 'email'
    } & SignInPasswordlessEmailParams)
  | ({
      signInMethod: 'passwordless'
      connection: 'sms'
    } & SignInPasswordlessSmsParams)

export type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT'

export type AuthChangedFunction = (event: AuthChangeEvent, session: NhostSession | null) => void

export type OnTokenChangedFunction = (session: NhostSession | null) => void

export interface AuthOptions {
  /** Unique key used for inter-tab communication to synchronize authentication state. */
  broadcastKey?: string
  /** Time interval until token refreshes, in seconds */
  refreshIntervalTime?: number
  /**
   * Define a way to get information about the refresh token and its exipration date.
   * @default web */
  clientStorageType?: ClientStorageType
  /** Object where the refresh token will be persisted and read locally.
   *
   * Recommended values:
   *
   * - `'web'` and `'cookies'`: no value is required
   * - `'react-native'`: use [@react-native-async-storage/async-storage](https://www.npmjs.com/package/@react-native-async-storage/async-storage)
   *   ```ts
   *   import { NhostClient } from '@nhost/nhost-js'
   *   import AsyncStorage from '@react-native-async-storage/async-storage';
   *   const nhost = new NhostClient({
   *     ...
   *     clientStorageType: 'react-native',
   *     clientStorage: AsyncStorage
   *   })
   *   ```
   * - `'custom'`: an object that defines the following methods:
   *   - `setItem` or `setItemAsync`
   *   - `getItem` or `getItemAsync`
   *   - `removeItem`
   * - `'capacitor'`:
   *
   *   - capacitor version **< 4** : use [@capacitor/storage](https://www.npmjs.com/package/@capacitor/storage)
   *
   *   ```ts
   *   import { NhostClient } from '@nhost/nhost-js'
   *   import { Storage } from '@capacitor/storage'
   *   const nhost = new NhostClient({
   *     ...
   *     clientStorageType: 'capacitor',
   *     clientStorage: Storage
   *   })
   *   ```
   *
   *   - capacitor version **>= 4** : use [@capacitor/preferences](https://www.npmjs.com/package/@capacitor/preferences)
   *
   *   ```ts
   *   import { NhostClient  } from '@nhost/nhost-js';
   *   import { Preferences } from '@capacitor/preferences';
   *   const nhost = new NhostClient({
   *     ...
   *     clientStorageType: 'custom',
   *     clientStorage: {
   *       setItemAsync: async (key, value) => Preferences.set({ key, value }),
   *       getItemAsync: async (key) => {
   *         const { value } = await Preferences.get({ key });
   *         return value;
   *       },
   *       removeItem: (key) => Preferences.remove({ key })
   *     },
   *   });
   *   ```
   *
   * - `'expo-secure-store'`: use [expo-secure-store](https://www.npmjs.com/package/expo-secure-store)
   *   ```ts
   *     import { NhostClient } from '@nhost/nhost-js'
   *     import * as SecureStore from 'expo-secure-store';
   *     const nhost = new NhostClient({
   *       ...
   *       clientStorageType: 'expo-secure-store',
   *       clientStorage: SecureStore
   *     })
   *   ```
   */
  clientStorage?: ClientStorage
  /**
   *  @internal @deprecated Use clientStorage / clientStorageType instead  */
  clientStorageGetter?: StorageGetter
  /**
   * Define a way to set information about the refresh token and its exipration date.
   * @internal @deprecated  Use clientStorage / clientStorageType instead  */
  clientStorageSetter?: StorageSetter
  /** When set to true, will automatically refresh token before it expires */
  autoRefreshToken?: boolean
  /** When set to true, will parse the url on startup to check if it contains a refresh token to start the session with */
  autoSignIn?: boolean
  /** Activate devTools e.g. the ability to connect to the xstate inspector */
  devTools?: boolean
}
