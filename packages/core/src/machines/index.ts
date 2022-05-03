import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { assign, createMachine, send } from 'xstate'

import {
  NHOST_JWT_EXPIRES_AT_KEY,
  NHOST_REFRESH_TOKEN_KEY,
  REFRESH_TOKEN_RETRY_INTERVAL,
  TOKEN_REFRESH_MARGIN
} from '../constants'
import {
  INVALID_EMAIL_ERROR,
  INVALID_PASSWORD_ERROR,
  INVALID_PHONE_NUMBER_ERROR,
  NO_MFA_TICKET_ERROR,
  VALIDATION_ERROR_CODE,
  ValidationErrorPayload
} from '../errors'
import { nhostApiClient } from '../hasura-auth'
import { StorageGetter, StorageSetter } from '../storage'
import { Mfa, NhostSession } from '../types'
import { getParameterByName, removeParameterFromWindow, rewriteRedirectTo } from '../utils'
import { isValidEmail, isValidPassword, isValidPhoneNumber } from '../validators'

import { AuthContext, INITIAL_MACHINE_CONTEXT, StateErrorTypes } from './context'
import { AuthEvents } from './events'

export type { AuthContext, AuthEvents, StateErrorTypes }
export * from './change-email'
export * from './change-password'
export * from './enable-mfa'
export * from './reset-password'
export * from './send-verification-email'

export type AuthMachineOptions = {
  backendUrl: string
  clientUrl?: string
  refreshIntervalTime?: number
  clientStorageGetter?: StorageGetter
  clientStorageSetter?: StorageSetter
  autoSignIn?: boolean
  autoRefreshToken?: boolean
}

export type AuthMachine = ReturnType<typeof createAuthMachine>

// TODO actions typings

export const createAuthMachine = ({
  backendUrl,
  clientUrl,
  clientStorageGetter,
  clientStorageSetter,
  refreshIntervalTime,
  autoRefreshToken = true,
  autoSignIn = true
}: Required<Omit<AuthMachineOptions, 'refreshIntervalTime'>> &
  Pick<AuthMachineOptions, 'refreshIntervalTime'>) => {
  const api = nhostApiClient(backendUrl)
  const postRequest = async <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<D>
  ): Promise<R> => {
    const result = await api.post(url, data, config)
    return result.data
  }
  return createMachine(
    {
      schema: {
        context: {} as AuthContext,
        events: {} as AuthEvents
      },
      tsTypes: {} as import('./index.typegen').Typegen0,
      context: INITIAL_MACHINE_CONTEXT,
      preserveActionOrder: true,
      id: 'nhost',
      type: 'parallel',
      states: {
        authentication: {
          initial: 'importingRefreshToken',
          on: {
            SESSION_UPDATE: [
              {
                cond: 'hasSession',
                actions: ['saveSession', 'persist', 'resetTimer', 'reportTokenChanged'],
                target: '.signedIn'
              }
            ]
          },
          states: {
            importingRefreshToken: {
              always: { cond: 'isSignedIn', target: 'signedIn' },
              invoke: {
                id: 'importRefreshToken',
                src: 'importRefreshToken',
                onDone: { actions: 'saveRefreshToken', target: 'starting' },
                onError: { actions: ['saveAuthenticationError'], target: 'signedOut' }
              }
            },
            starting: {
              always: [
                {
                  cond: 'hasRefreshTokenWithoutSession',
                  target: 'authenticating.token'
                },
                { cond: 'hasAuthenticationError', target: 'signedOut.failed' },
                'signedOut'
              ]
            },
            signedOut: {
              tags: ['ready'],
              initial: 'noErrors',
              entry: 'reportSignedOut',
              states: {
                noErrors: {},
                success: {},
                needsEmailVerification: {},
                needsSmsOtp: {},
                needsMfa: {},
                failed: {
                  exit: 'resetAuthenticationError',
                  initial: 'server',
                  states: {
                    server: {},
                    validation: {
                      states: {
                        password: {},
                        email: {},
                        phoneNumber: {}
                      }
                    }
                  }
                },
                signingOut: {
                  entry: ['clearContextExceptRefreshToken'],
                  exit: ['destroyRefreshToken', 'reportTokenChanged'],
                  invoke: {
                    src: 'signout',
                    id: 'signingOut',
                    onDone: {
                      target: 'success'
                    },
                    onError: {
                      target: 'failed.server'
                      // TODO save error
                    }
                  }
                }
              },
              on: {
                SIGNIN_PASSWORD: '#nhost.authentication.authenticating.password',
                SIGNIN_PASSWORDLESS_EMAIL: '#nhost.authentication.authenticating.passwordlessEmail',
                SIGNIN_PASSWORDLESS_SMS: '#nhost.authentication.authenticating.passwordlessSms',
                SIGNIN_PASSWORDLESS_SMS_OTP:
                  '#nhost.authentication.authenticating.passwordlessSmsOtp',
                SIGNUP_EMAIL_PASSWORD: '#nhost.authentication.registering',
                SIGNIN_ANONYMOUS: '#nhost.authentication.authenticating.anonymous',
                SIGNIN_MFA_TOTP: '#nhost.authentication.authenticating.mfa.totp'
              }
            },
            authenticating: {
              states: {
                passwordlessEmail: {
                  invoke: {
                    src: 'signInPasswordlessEmail',
                    id: 'authenticatePasswordlessEmail',
                    onDone: '#nhost.authentication.signedOut.needsEmailVerification',
                    onError: {
                      actions: 'saveAuthenticationError',
                      target: '#nhost.authentication.signedOut.failed.server'
                    }
                  }
                },
                passwordlessSms: {
                  invoke: {
                    src: 'signInPasswordlessSms',
                    id: 'authenticatePasswordlessSms',
                    onDone: '#nhost.authentication.signedOut.needsSmsOtp',
                    onError: {
                      actions: 'saveAuthenticationError',
                      target: '#nhost.authentication.signedOut.failed.server'
                    }
                  }
                },
                passwordlessSmsOtp: {
                  invoke: {
                    src: 'signInPasswordlessSmsOtp',
                    id: 'authenticatePasswordlessSmsOtp',
                    onDone: {
                      actions: ['saveSession', 'persist', 'reportTokenChanged'],
                      target: '#nhost.authentication.signedIn'
                    },
                    onError: {
                      actions: 'saveAuthenticationError',
                      target: '#nhost.authentication.signedOut.failed.server'
                    }
                  }
                },
                password: {
                  invoke: {
                    src: 'signInPassword',
                    id: 'authenticateUserWithPassword',
                    onDone: [
                      {
                        cond: 'hasMfaTicket',
                        actions: ['saveMfaTicket'],
                        target: '#nhost.authentication.signedOut.needsMfa'
                      },
                      {
                        actions: ['saveSession', 'persist', 'reportTokenChanged'],
                        target: '#nhost.authentication.signedIn'
                      }
                    ],
                    onError: [
                      {
                        cond: 'unverified',
                        target: '#nhost.authentication.signedOut.needsEmailVerification'
                      },
                      {
                        actions: 'saveAuthenticationError',
                        target: '#nhost.authentication.signedOut.failed.server'
                      }
                    ]
                  }
                },
                token: {
                  invoke: {
                    src: 'refreshToken',
                    id: 'signInToken',
                    onDone: {
                      actions: ['saveSession', 'persist', 'reportTokenChanged', 'broadcastToken'],
                      target: '#nhost.authentication.signedIn'
                    },
                    onError: {
                      actions: 'saveAuthenticationError',
                      target: '#nhost.authentication.signedOut.failed.server'
                    }
                  }
                },
                anonymous: {
                  invoke: {
                    src: 'signInAnonymous',
                    id: 'authenticateAnonymously',
                    onDone: {
                      actions: ['saveSession', 'persist', 'reportTokenChanged'],
                      target: '#nhost.authentication.signedIn'
                    },
                    onError: {
                      actions: 'saveAuthenticationError',
                      target: '#nhost.authentication.signedOut.failed.server'
                    }
                  }
                },
                mfa: {
                  states: {
                    totp: {
                      invoke: {
                        src: 'signInMfaTotp',
                        id: 'signInMfaTotp',
                        onDone: {
                          actions: ['saveSession', 'persist', 'reportTokenChanged'],
                          target: '#nhost.authentication.signedIn'
                        },
                        onError: {
                          actions: ['saveAuthenticationError'],
                          target: '#nhost.authentication.signedOut.failed.server'
                        }
                      }
                    }
                  }
                }
              }
            },
            registering: {
              entry: 'resetSignUpError',
              invoke: {
                src: 'signUpUser',
                id: 'signUpUser',
                onDone: [
                  {
                    cond: 'hasSession',
                    target: '#nhost.authentication.signedIn',
                    actions: ['saveSession', 'persist', 'reportTokenChanged']
                  },
                  {
                    target: '#nhost.authentication.signedOut.needsEmailVerification'
                  }
                ],
                onError: [
                  {
                    cond: 'unverified',
                    target: '#nhost.authentication.signedOut.needsEmailVerification'
                  },
                  {
                    actions: 'saveRegisrationError',
                    target: '#nhost.authentication.signedOut.failed.server'
                  }
                ]
              }
            },

            signedIn: {
              tags: ['ready'],
              type: 'parallel',
              entry: ['reportSignedIn', 'cleanUrl'],
              on: {
                SIGNOUT: '#nhost.authentication.signedOut.signingOut',
                DEANONYMIZE: {
                  // TODO implement
                  target: '.deanonymizing'
                }
              },
              states: {
                refreshTimer: {
                  id: 'timer',
                  initial: 'idle',
                  states: {
                    disabled: { type: 'final' },
                    stopped: {
                      always: {
                        cond: 'noToken',
                        target: 'idle'
                      }
                    },
                    idle: {
                      always: [
                        { cond: 'isAutoRefreshDisabled', target: 'disabled' },
                        {
                          cond: 'hasRefreshToken',
                          target: 'running'
                        }
                      ]
                    },
                    running: {
                      initial: 'pending',
                      entry: 'resetTimer',
                      states: {
                        pending: {
                          after: {
                            '1000': {
                              internal: false,
                              target: 'pending'
                            }
                          },
                          always: {
                            cond: 'refreshTimerShouldRefresh',
                            target: 'refreshing'
                          }
                        },
                        refreshing: {
                          invoke: {
                            src: 'refreshToken',
                            id: 'refreshToken',
                            onDone: {
                              actions: [
                                'saveSession',
                                'persist',
                                'resetTimer',
                                'reportTokenChanged'
                              ],
                              target: 'pending'
                            },
                            onError: [
                              { actions: 'saveRefreshAttempt', target: 'pending' }
                              // ? stop trying after x attempts?
                              // {
                              //   actions: 'retry',
                              //   cond: 'canRetry',
                              //   target: 'pending'
                              // },
                              // {
                              //   actions: ['sendError', 'resetToken'],
                              //   target: '#timer.stopped'
                              // }
                            ]
                          }
                        }
                      }
                    }
                  }
                },
                deanonymizing: {
                  // TODO implement
                  initial: 'error',
                  states: {
                    error: {},
                    success: {}
                  }
                }
              }
            }
          }
        },
        token: {
          initial: 'idle',
          states: {
            idle: {
              on: {
                TRY_TOKEN: 'running'
              },
              initial: 'noErrors',
              states: { noErrors: {}, error: {} }
            },
            running: {
              invoke: {
                src: 'refreshToken',
                id: 'authenticateWithToken',
                onDone: {
                  actions: ['saveSession', 'persist', 'reportTokenChanged'],
                  target: ['#nhost.authentication.signedIn', 'idle.noErrors']
                },
                onError: [
                  // TODO save error
                  { cond: 'isSignedIn', target: 'idle.error' },
                  {
                    target: ['#nhost.authentication.signedOut', 'idle.error']
                  }
                ]
              }
            }
          }
        }
      }
    },
    {
      actions: {
        reportSignedIn: send('SIGNED_IN'),
        reportSignedOut: send('SIGNED_OUT'),
        reportTokenChanged: send('TOKEN_CHANGED'),
        clearContextExceptRefreshToken: assign(({ refreshToken: { value } }) => {
          clientStorageSetter(NHOST_JWT_EXPIRES_AT_KEY, null)
          return {
            ...INITIAL_MACHINE_CONTEXT,
            refreshToken: { value }
          }
        }),

        saveSession: assign({
          user: (_, e: any) => e.data?.session?.user,
          accessToken: (_, e) => ({
            value: e.data?.session?.accessToken,
            expiresAt: new Date(Date.now() + e.data?.session?.accessTokenExpiresIn * 1_000)
          }),
          refreshToken: (_, e) => ({ value: e.data?.session?.refreshToken })
        }),
        saveMfaTicket: assign({
          mfa: (_, e: any) => e.data?.mfa ?? null
        }),

        resetTimer: assign({
          refreshTimer: (ctx, e) => ({
            startedAt: new Date(),
            attempts: 0,
            lastAttempt: null
          })
        }),

        saveRefreshAttempt: assign({
          refreshTimer: (ctx, e) => ({
            startedAt: ctx.refreshTimer.startedAt,
            attempts: ctx.refreshTimer.attempts + 1,
            lastAttempt: new Date()
          })
        }),

        // * Authenticaiton errors
        saveAuthenticationError: assign({
          errors: ({ errors }, { data: { error } }: any) => ({ ...errors, authentication: error })
        }),
        resetAuthenticationError: assign({
          errors: ({ errors: { authentication, ...errors } }) => errors
        }),
        saveRegisrationError: assign({
          errors: ({ errors }, { data: { error } }: any) => ({ ...errors, registration: error })
        }),
        resetSignUpError: assign({
          errors: ({ errors: { registration, ...errors } }) => errors
        }),
        saveRefreshToken: assign({
          accessToken: (ctx, e: any) => ({ ...ctx.accessToken, expiresAt: e.data.expiresAt }),
          refreshToken: (ctx, e: any) => ({ ...ctx.refreshToken, value: e.data.refreshToken })
        }),
        // * Persist the refresh token and the jwt expiration outside of the machine
        persist: (_, { data }: any) => {
          clientStorageSetter(NHOST_REFRESH_TOKEN_KEY, data.session.refreshToken)
          if (data.session.accessTokenExpiresIn) {
            const nextRefresh = new Date(
              Date.now() + data.session.accessTokenExpiresIn * 1_000
            ).toISOString()
            clientStorageSetter(NHOST_JWT_EXPIRES_AT_KEY, nextRefresh)
          } else {
            clientStorageSetter(NHOST_JWT_EXPIRES_AT_KEY, null)
          }
        },
        destroyRefreshToken: assign({
          refreshToken: (_) => {
            clientStorageSetter(NHOST_REFRESH_TOKEN_KEY, null)
            return { value: null }
          }
        }),

        // * Clean the browser url when `autoSignIn` is activated
        cleanUrl: () => {
          if (autoSignIn && getParameterByName('refreshToken')) {
            // * Remove the refresh token from the URL
            removeParameterFromWindow('refreshToken')
            removeParameterFromWindow('type')
          }
        },

        // * Broadcast the token to other tabs when `autoSignIn` is activated
        broadcastToken: (context) => {
          if (autoSignIn) {
            try {
              const channel = new BroadcastChannel('nhost')
              // ? broadcat session instead of token ?
              channel.postMessage(context.refreshToken.value)
            } catch (error) {
              // * BroadcastChannel is not available e.g. react-native
            }
          }
        }
      },

      guards: {
        isSignedIn: (ctx) => !!ctx.user && !!ctx.refreshToken.value && !!ctx.accessToken.value,
        hasRefreshTokenWithoutSession: (ctx) =>
          !!ctx.refreshToken.value && !ctx.user && !ctx.accessToken.value,
        noToken: (ctx) => !ctx.refreshToken.value,
        hasRefreshToken: (ctx) => !!ctx.refreshToken.value,
        hasAuthenticationError: (ctx) => !!ctx.errors.authentication,
        isAutoRefreshDisabled: () => !autoRefreshToken,
        refreshTimerShouldRefresh: (ctx) => {
          const { expiresAt } = ctx.accessToken
          if (!expiresAt) {
            return false
          }
          if (ctx.refreshTimer.lastAttempt) {
            // * If a refesh previously failed, only try to refresh every `REFRESH_TOKEN_RETRY_INTERVAL` seconds
            const elapsed = Date.now() - ctx.refreshTimer.lastAttempt.getTime()
            return elapsed > REFRESH_TOKEN_RETRY_INTERVAL * 1_000
          }
          if (refreshIntervalTime) {
            // * If a refreshIntervalTime has been passed on as an option, it will notify
            // * the token should be refershed when this interval is overdue
            const elapsed = Date.now() - (ctx.refreshTimer.startedAt?.getTime() || 0)
            if (elapsed > refreshIntervalTime * 1_000) {
              return true
            }
          }
          // * In any case, it's time to refresh when there's less than
          // * TOKEN_REFRESH_MARGIN seconds before the JWT exprires
          const expiresIn = expiresAt.getTime() - Date.now()
          const remaining = expiresIn - 1_000 * TOKEN_REFRESH_MARGIN
          return remaining <= 0
        },
        // * Authentication errors
        unverified: (_, { data: { error } }: any) =>
          error.status === 401 &&
          // * legacy: don't use the message contents to determine if the email is unverified, but the error type (error.error)
          (error.message === 'Email is not verified' || error.error === 'unverified-user'),

        // * Event guards
        hasSession: (_, e: any) => !!e.data?.session,
        hasMfaTicket: (_, e: any) => !!e.data?.mfa
      },

      services: {
        signInPassword: (_, { email, password }) => {
          if (!isValidEmail(email)) {
            return Promise.reject({ error: INVALID_EMAIL_ERROR })
          }
          if (!isValidPassword(password)) {
            return Promise.reject({ error: INVALID_PASSWORD_ERROR })
          }
          return postRequest('/signin/email-password', {
            email,
            password
          })
        },
        signInPasswordlessSms: (_, { phoneNumber, options }) => {
          if (!isValidPhoneNumber(phoneNumber)) {
            return Promise.reject({ error: INVALID_PHONE_NUMBER_ERROR })
          }

          return postRequest('/signin/passwordless/sms', {
            phoneNumber,
            options: rewriteRedirectTo(clientUrl, options)
          })
        },
        signInPasswordlessSmsOtp: (_, { phoneNumber, otp }) => {
          if (!isValidPhoneNumber(phoneNumber)) {
            return Promise.reject({ error: INVALID_PHONE_NUMBER_ERROR })
          }
          return postRequest('/signin/passwordless/sms/otp', {
            phoneNumber,
            otp
          })
        },
        signInPasswordlessEmail: async (_, { email, options }) => {
          if (!isValidEmail(email)) {
            return Promise.reject({ error: INVALID_EMAIL_ERROR })
          }
          return postRequest('/signin/passwordless/email', {
            email,
            options: rewriteRedirectTo(clientUrl, options)
          })
        },
        signInAnonymous: (_) => postRequest('/signin/anonymous'),
        signInMfaTotp: (context, { ticket, otp }) => {
          if (!ticket && !context.mfa?.ticket) {
            return Promise.reject({ error: NO_MFA_TICKET_ERROR })
          }

          return postRequest<
            { mfa: Mfa | null; session: NhostSession | null },
            { mfa: Mfa | null; session: NhostSession | null }
          >('/signin/mfa/totp', {
            ticket: ticket || context.mfa?.ticket,
            otp
          })
        },
        refreshToken: async (ctx, event) => {
          const refreshToken = event.type === 'TRY_TOKEN' ? event.token : ctx.refreshToken.value
          const session = await postRequest('/token', {
            refreshToken
          })
          return { session }
        },
        signout: (ctx, e) =>
          postRequest('/signout', {
            refreshToken: ctx.refreshToken.value,
            all: !!e.all
          }),

        signUpUser: (_, { email, password, options }) => {
          if (!isValidEmail(email)) {
            return Promise.reject({ error: INVALID_EMAIL_ERROR })
          }
          if (!isValidPassword(password)) {
            return Promise.reject({ error: INVALID_PASSWORD_ERROR })
          }
          return postRequest('/signup/email-password', {
            email,
            password,
            options: rewriteRedirectTo(clientUrl, options)
          })
        },

        importRefreshToken: async () => {
          const stringExpiresAt = await clientStorageGetter(NHOST_JWT_EXPIRES_AT_KEY)
          const expiresAt = stringExpiresAt ? new Date(stringExpiresAt) : null
          let refreshToken = await clientStorageGetter(NHOST_REFRESH_TOKEN_KEY)
          if (autoSignIn) {
            const urlToken = getParameterByName('refreshToken') || null
            if (urlToken) {
              if (!refreshToken) {
                // ? Which takes precedence? localStorage or the url?
                refreshToken = urlToken
              }
            } else {
              const error = getParameterByName('error')
              if (error) {
                return Promise.reject<{ error: ValidationErrorPayload }>({
                  error: {
                    status: VALIDATION_ERROR_CODE,
                    error,
                    message: getParameterByName('errorDescription') || error
                  }
                })
              }
            }
          }
          return refreshToken
            ? {
                refreshToken,
                expiresAt
              }
            : Promise.reject<{ error: ValidationErrorPayload }>({
                error: null
              })
        }
      }
    }
  )
}
