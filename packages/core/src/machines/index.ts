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
  INVALID_MFA_TICKET_ERROR,
  INVALID_PASSWORD_ERROR,
  INVALID_PHONE_NUMBER_ERROR,
  NO_MFA_TICKET_ERROR,
  VALIDATION_ERROR_CODE,
  ValidationErrorPayload
} from '../errors'
import { nhostApiClient } from '../hasura-auth'
import { localStorageGetter, localStorageSetter } from '../storage'
import { AuthOptions, Mfa, NhostSession } from '../types'
import { getParameterByName, removeParameterFromWindow, rewriteRedirectTo } from '../utils'
import { isValidEmail, isValidPassword, isValidPhoneNumber, isValidTicket } from '../validators'

import { AuthContext, INITIAL_MACHINE_CONTEXT } from './context'
import { AuthEvents } from './events'

export type { AuthContext, AuthEvents }
export * from './change-email'
export * from './change-password'
export * from './enable-mfa'
export * from './reset-password'
export * from './send-verification-email'

export interface AuthMachineOptions extends AuthOptions {
  backendUrl: string
  clientUrl: string
}

export type AuthMachine = ReturnType<typeof createAuthMachine>

// TODO actions typings

export const createAuthMachine = ({
  backendUrl,
  clientUrl,
  clientStorageGetter,
  clientStorageSetter,
  clientStorageType = 'web',
  clientStorage,
  refreshIntervalTime,
  autoRefreshToken = true,
  autoSignIn = true
}: AuthMachineOptions) => {
  const storageGetter = clientStorageGetter || localStorageGetter(clientStorageType, clientStorage)
  const storageSetter = clientStorageSetter || localStorageSetter(clientStorageType, clientStorage)
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
          initial: 'starting',
          on: {
            SESSION_UPDATE: [
              {
                cond: 'hasSession',
                actions: ['saveSession', 'resetTimer', 'reportTokenChanged'],
                target: '.signedIn'
              }
            ]
          },
          states: {
            starting: {
              entry: 'resetErrors',
              tags: ['loading'],
              always: { cond: 'isSignedIn', target: 'signedIn' },
              invoke: {
                id: 'importRefreshToken',
                src: 'importRefreshToken',
                onDone: {
                  actions: ['saveSession', 'reportTokenChanged'],
                  target: 'signedIn'
                },
                onError: { actions: ['saveAuthenticationError'], target: 'signedOut' }
              }
            },
            signedOut: {
              initial: 'noErrors',
              entry: 'reportSignedOut',
              states: {
                noErrors: {},
                success: {},
                needsSmsOtp: {},
                needsMfa: {},
                failed: {
                  initial: 'server',
                  states: {
                    server: {},
                    validation: {
                      states: {
                        password: {},
                        email: {},
                        phoneNumber: {},
                        mfaTicket: {}
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
                      target: 'failed.server',
                      actions: ['saveAuthenticationError']
                    }
                  }
                }
              },
              on: {
                SIGNIN_PASSWORD: [
                  {
                    cond: 'invalidEmail',
                    actions: ['saveInvalidEmail'],
                    target: '.failed.validation.email'
                  },
                  {
                    cond: 'invalidPassword',
                    actions: ['saveInvalidPassword'],
                    target: '.failed.validation.password'
                  },
                  '#nhost.authentication.authenticating.password'
                ],
                SIGNIN_PASSWORDLESS_EMAIL: [
                  {
                    cond: 'invalidEmail',
                    actions: 'saveInvalidEmail',
                    target: '.failed.validation.email'
                  },
                  '#nhost.authentication.authenticating.passwordlessEmail'
                ],
                SIGNIN_PASSWORDLESS_SMS: [
                  {
                    cond: 'invalidPhoneNumber',
                    actions: 'saveInvalidPhoneNumber',
                    target: '.failed.validation.phoneNumber'
                  },
                  '#nhost.authentication.authenticating.passwordlessSms'
                ],
                SIGNIN_PASSWORDLESS_SMS_OTP: [
                  {
                    cond: 'invalidPhoneNumber',
                    actions: 'saveInvalidPhoneNumber',
                    target: '.failed.validation.phoneNumber'
                  },
                  '#nhost.authentication.authenticating.passwordlessSmsOtp'
                ],
                SIGNUP_EMAIL_PASSWORD: [
                  {
                    cond: 'invalidEmail',
                    actions: 'saveInvalidSignUpEmail',
                    target: '.failed.validation.email'
                  },
                  {
                    cond: 'invalidPassword',
                    actions: 'saveInvalidSignUpPassword',
                    target: '.failed.validation.password'
                  },
                  '#nhost.authentication.registering'
                ],
                SIGNIN_ANONYMOUS: '#nhost.authentication.authenticating.anonymous',
                SIGNIN_MFA_TOTP: [
                  {
                    cond: 'noMfaTicket',
                    actions: ['saveNoMfaTicketError'],
                    target: '.failed'
                  },
                  {
                    cond: 'invalidMfaTicket',
                    actions: ['saveInvalidMfaTicketError'],
                    target: '.failed'
                  },
                  '#nhost.authentication.authenticating.mfa.totp'
                ]
              }
            },
            authenticating: {
              entry: 'resetErrors',
              states: {
                passwordlessEmail: {
                  invoke: {
                    src: 'signInPasswordlessEmail',
                    id: 'authenticatePasswordlessEmail',
                    onDone: {
                      target: '#nhost.authentication.signedOut',
                      actions: 'reportAwaitEmailVerification'
                    },
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
                      actions: ['saveSession', 'reportTokenChanged'],
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
                        actions: ['saveSession', 'reportTokenChanged'],
                        target: '#nhost.authentication.signedIn'
                      }
                    ],
                    onError: [
                      {
                        cond: 'unverified',
                        actions: 'reportAwaitEmailVerification',
                        target: '#nhost.authentication.signedOut'
                      },
                      {
                        actions: 'saveAuthenticationError',
                        target: '#nhost.authentication.signedOut.failed.server'
                      }
                    ]
                  }
                },
                anonymous: {
                  invoke: {
                    src: 'signInAnonymous',
                    id: 'authenticateAnonymously',
                    onDone: {
                      actions: ['saveSession', 'reportTokenChanged'],
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
                          actions: ['saveSession', 'reportTokenChanged'],
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
              entry: ['resetErrors'],
              invoke: {
                src: 'registerUser',
                id: 'registerUser',
                onDone: [
                  {
                    cond: 'hasSession',
                    target: 'signedIn',
                    actions: ['saveSession', 'reportTokenChanged']
                  },
                  {
                    actions: 'reportAwaitEmailVerification',
                    target: 'signedOut'
                  }
                ],
                onError: [
                  {
                    cond: 'unverified',
                    actions: 'reportAwaitEmailVerification',
                    target: 'signedOut'
                  },
                  {
                    actions: 'saveRegistrationError',
                    target: 'signedOut.failed.server'
                  }
                ]
              }
            },
            signedIn: {
              type: 'parallel',
              entry: ['reportSignedIn', 'cleanUrl', 'broadcastToken', 'resetErrors'],
              on: {
                SIGNOUT: 'signedOut.signingOut',
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
                              actions: ['saveSession', 'resetTimer', 'reportTokenChanged'],
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
                  actions: ['saveSession', 'reportTokenChanged'],
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
        },
        email: {
          initial: 'unknown',
          on: {
            SIGNED_IN: [
              {
                cond: 'needsVerification',
                target: '.awaitingVerification'
              },
              '.valid'
            ],
            SIGNOUT: '.unknown',
            AWAIT_EMAIL_VERIFICATION: '.awaitingVerification'
          },
          states: {
            unknown: {},
            awaitingVerification: {},
            valid: {}
          }
        }
      }
    },
    {
      actions: {
        reportSignedIn: send('SIGNED_IN'),
        reportSignedOut: send('SIGNED_OUT'),
        reportAwaitEmailVerification: send('AWAIT_EMAIL_VERIFICATION'),
        reportTokenChanged: send('TOKEN_CHANGED'),
        clearContextExceptRefreshToken: assign(({ refreshToken: { value } }) => {
          storageSetter(NHOST_JWT_EXPIRES_AT_KEY, null)
          return {
            ...INITIAL_MACHINE_CONTEXT,
            refreshToken: { value }
          }
        }),

        // * Save session in the context, and persist the refresh token and the jwt expiration outside of the machine
        saveSession: assign({
          user: (_, { data }: any) => data?.session?.user,
          accessToken: (_, { data }: any) => {
            if (data.session.accessTokenExpiresIn) {
              const nextRefresh = new Date(
                Date.now() + data.session.accessTokenExpiresIn * 1_000
              ).toISOString()
              storageSetter(NHOST_JWT_EXPIRES_AT_KEY, nextRefresh)
            } else {
              storageSetter(NHOST_JWT_EXPIRES_AT_KEY, null)
            }
            return {
              value: data?.session?.accessToken,
              expiresAt: new Date(Date.now() + data?.session?.accessTokenExpiresIn * 1_000)
            }
          },
          refreshToken: (_, { data }: any) => {
            storageSetter(NHOST_REFRESH_TOKEN_KEY, data.session.refreshToken)

            return { value: data?.session?.refreshToken }
          }
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
        resetErrors: assign({
          errors: (_) => ({})
        }),
        saveInvalidEmail: assign({
          errors: ({ errors }) => ({ ...errors, authentication: INVALID_EMAIL_ERROR })
        }),
        saveInvalidPassword: assign({
          errors: ({ errors }) => ({ ...errors, authentication: INVALID_PASSWORD_ERROR })
        }),
        saveInvalidPhoneNumber: assign({
          errors: ({ errors }) => ({ ...errors, authentication: INVALID_PHONE_NUMBER_ERROR })
        }),
        saveInvalidMfaTicketError: assign({
          errors: ({ errors }) => ({ ...errors, authentication: INVALID_MFA_TICKET_ERROR })
        }),
        saveNoMfaTicketError: assign({
          errors: ({ errors }) => ({ ...errors, authentication: NO_MFA_TICKET_ERROR })
        }),
        saveRegistrationError: assign({
          errors: ({ errors }, { data: { error } }: any) => ({ ...errors, registration: error })
        }),
        saveInvalidSignUpPassword: assign({
          errors: ({ errors }) => ({ ...errors, registration: INVALID_PASSWORD_ERROR })
        }),
        saveInvalidSignUpEmail: assign({
          errors: ({ errors }) => ({ ...errors, registration: INVALID_EMAIL_ERROR })
        }),

        destroyRefreshToken: assign({
          refreshToken: (_) => {
            storageSetter(NHOST_REFRESH_TOKEN_KEY, null)
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
        needsVerification: (ctx, e) => {
          return !ctx.user || ctx.user.isAnonymous
        },
        isSignedIn: (ctx) => !!ctx.user && !!ctx.refreshToken.value && !!ctx.accessToken.value,
        noToken: (ctx) => !ctx.refreshToken.value,
        noMfaTicket: (ctx, { ticket }) => !ticket && !ctx.mfa?.ticket,
        hasRefreshToken: (ctx) => !!ctx.refreshToken.value,
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
          error.status === 401 && error.message === 'Email is not verified',

        // * Event guards
        hasSession: (_, e: any) => !!e.data?.session,
        hasMfaTicket: (_, e: any) => !!e.data?.mfa,
        invalidEmail: (_, { email }) => !isValidEmail(email),
        invalidPassword: (_, { password }) => !isValidPassword(password),
        invalidPhoneNumber: (_, { phoneNumber }) => !isValidPhoneNumber(phoneNumber),
        invalidMfaTicket: (ctx, { ticket }) => !isValidTicket(ticket || ctx.mfa?.ticket)
      },

      services: {
        signInPassword: (_, { email, password }) =>
          postRequest('/signin/email-password', {
            email,
            password
          }),
        signInPasswordlessSms: (_, { phoneNumber, options }) =>
          postRequest('/signin/passwordless/sms', {
            phoneNumber,
            options: rewriteRedirectTo(clientUrl, options)
          }),
        signInPasswordlessSmsOtp: (_, { phoneNumber, otp }) =>
          postRequest('/signin/passwordless/sms/otp', {
            phoneNumber,
            otp
          }),

        signInPasswordlessEmail: (_, { email, options }) =>
          postRequest('/signin/passwordless/email', {
            email,
            options: rewriteRedirectTo(clientUrl, options)
          }),
        signInAnonymous: (_) => postRequest('/signin/anonymous'),
        signInMfaTotp: (context, { ticket, otp }) =>
          postRequest<
            { mfa: Mfa | null; session: NhostSession | null },
            { mfa: Mfa | null; session: NhostSession | null }
          >('/signin/mfa/totp', {
            ticket: ticket || context.mfa?.ticket,
            otp
          }),
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

        registerUser: (_, { email, password, options }) =>
          postRequest('/signup/email-password', {
            email,
            password,
            options: rewriteRedirectTo(clientUrl, options)
          }),

        importRefreshToken: async () => {
          let error: ValidationErrorPayload | null = null
          if (autoSignIn) {
            const urlToken = getParameterByName('refreshToken') || null
            if (urlToken) {
              try {
                const session = await postRequest('/token', {
                  refreshToken: urlToken
                })
                return { session }
              } catch (exception) {
                error = (exception as { error: ValidationErrorPayload }).error
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
          const storageToken = await storageGetter(NHOST_REFRESH_TOKEN_KEY)
          if (storageToken) {
            try {
              const session = await postRequest('/token', {
                refreshToken: storageToken
              })
              return { session }
            } catch (exception) {
              error = (exception as { error: ValidationErrorPayload }).error
            }
          }

          return Promise.reject<{ error: ValidationErrorPayload }>({ error })
        }
      }
    }
  )
}
