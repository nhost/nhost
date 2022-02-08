import { validate as uuidValidate } from 'uuid'
import { assign } from '@xstate/immer'
import { createBackendServices } from './backend-services'
import {
  REFRESH_TOKEN_RETRY_INTERVAL,
  TOKEN_REFRESH_MARGIN,
  MIN_TOKEN_REFRESH_INTERVAL,
  NHOST_REFRESH_TOKEN,
  REFRESH_TOKEN_RETRY_MAX_ATTEMPTS,
  MIN_PASSWORD_LENGTH
} from './constants'
import { NhostContext } from './context'
import { nhostMachine } from './machine'
import { StorageGetter, StorageSetter } from './storage'

export type NhostInitOptions = {
  backendUrl: string
  storageGetter?: StorageGetter
  storageSetter?: StorageSetter
}
export const nhostMachineWithConfig = ({ backendUrl, storageSetter }: Required<NhostInitOptions>) =>
  nhostMachine.withConfig({
    // TODO type events in actions
    actions: {
      // * Persist the refresh token outside of the machine
      persistRefreshToken: (ctx) => {
        storageSetter(NHOST_REFRESH_TOKEN, ctx.refreshToken.value)
      },

      // * 'Token timer' errors
      resetTokenRefresherError: assign((ctx) => {
        ctx.refreshToken.timer.error = null
      }),
      saveTokenTimerError: assign((ctx, { data: { error } }) => {
        ctx.refreshToken.timer.error = error
      }),
      // * Refresh token timer
      resetTokenRefresher: assign((ctx) => {
        ctx.refreshToken.timer.elapsed = 0
        ctx.refreshToken.timer.attempts = 0
      }),
      tickTokenRefresher: assign((ctx) => {
        ctx.refreshToken.timer.elapsed += 1
      }),
      retryTokenRefresh: assign((ctx) => {
        ctx.accessToken.expiresIn = REFRESH_TOKEN_RETRY_INTERVAL
        ctx.refreshToken.timer.elapsed = 0
        ctx.refreshToken.timer.attempts += 1
      }),

      resetNewTokenError: assign((ctx) => {
        ctx.refreshToken.newToken.error = null
      }),
      saveNewTokenError: assign((ctx, { data: { error } }) => {
        ctx.refreshToken.newToken.error = error
      }),

      // * Save information after receiving token information
      saveToken: assign((ctx, e) => {
        ctx.user = e.data.user
        ctx.accessToken.value = e.data.accessToken
        ctx.accessToken.expiresIn = Math.max(
          e.data.accessTokenExpiresIn - TOKEN_REFRESH_MARGIN,
          MIN_TOKEN_REFRESH_INTERVAL
        )
        ctx.refreshToken.value = e.data.refreshToken
      }),

      // * Form
      clearForm: assign((ctx) => {
        ctx.email = undefined
        ctx.password = undefined
      }),
      saveEmail: assign((ctx, e) => {
        ctx.email = e.email
      }),
      savePassword: assign((ctx, e) => {
        ctx.password = e.password
      }),
      // * 'New email' errors
      saveNewEmailError: assign((ctx, { data: { error } }) => {
        ctx.newEmail.error = error
      }),
      resetNewEmailError: assign((ctx) => {
        ctx.newEmail.error = null
      }),
      saveNewPasswordError: assign((ctx, { data: { error } }) => {
        ctx.newPassword.error = error
      }),
      resetNewPasswordError: assign((ctx) => {
        ctx.newPassword.error = null
      }),
      resetSession: assign<NhostContext>((ctx) => {
        ctx.user = null
        ctx.mfa = false
        ctx.accessToken.value = null
        ctx.refreshToken.value = null
      }),

      // * Save information received after registration or login
      saveUser: assign((ctx, e) => {
        ctx.user = e.data.session.user
        ctx.accessToken.value = e.data.session.accessToken
        ctx.accessToken.expiresIn = Math.max(
          e.data.session.accessTokenExpiresIn - TOKEN_REFRESH_MARGIN,
          MIN_TOKEN_REFRESH_INTERVAL
        )
        ctx.refreshToken.value = e.data.session.refreshToken
        ctx.mfa = e.data.mfa
      }),

      // * Authenticaiton errors
      saveAuthenticationError: assign((ctx, { data: { error } }) => {
        ctx.error = error
      }),
      resetAuthenticationError: assign((ctx) => {
        ctx.error = null
      })
    },
    // TODO type events in guards
    guards: {
      isUserSet: (ctx) => !!ctx.user,
      // * Authentication errors
      unverified: (ctx) =>
        ctx.error?.status === 401 && ctx.error.message === 'Email is not verified',
      existingUser: (ctx) => ctx.error?.status === 409,
      unauthorized: (ctx) => ctx.error?.status === 401,
      networkError: (ctx, e) => ctx.error?.status === 0,
      // * New refresh token errors
      newTokenNetworkError: (ctx, e) => ctx.refreshToken.newToken.error?.status === 0,
      invalidRefreshToken: (_, e) => !uuidValidate(e.token),
      // * Context guards
      shouldStartTokenTimer: (ctx) => !!ctx.refreshToken.value,
      shouldWaitForToken: (ctx) => !ctx.refreshToken.value,
      shouldRefreshToken: (ctx) =>
        ctx.refreshToken.timer.elapsed >= ctx.accessToken.expiresIn || !ctx.user,
      // * Refresh token timer errors
      tokenRefresherNetworkError: (ctx, e) => ctx.refreshToken.timer.error?.status === 0,
      // can retry token refresh only if number of attempts is not reached, and there is a network error
      canRetryTokenRefresh: (ctx, event) => {
        const remainingAttempts = ctx.refreshToken.timer.attempts < REFRESH_TOKEN_RETRY_MAX_ATTEMPTS
        const isNetworkError = !event.data.response && !event.data.request.status
        return remainingAttempts && isNetworkError
      },
      // * Event guards
      hasUser: (_, e) => !!e.data.session,
      invalidEmail: (_, e) =>
        !String(e.email)
          .toLowerCase()
          .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
          ),
      invalidPassword: (_, e) => !e.password || e.password.length <= MIN_PASSWORD_LENGTH
    },
    services: createBackendServices(backendUrl)
  })
