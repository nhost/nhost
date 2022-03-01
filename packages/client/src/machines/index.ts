import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import produce from 'immer'
import { assign, createMachine } from 'xstate'

import {
  MIN_TOKEN_REFRESH_INTERVAL,
  NHOST_JWT_EXPIRES_AT_KEY,
  NHOST_REFRESH_TOKEN_KEY,
  TOKEN_REFRESH_MARGIN
} from '../constants'
import { INVALID_EMAIL_ERROR, INVALID_PASSWORD_ERROR } from '../errors'
import { nhostApiClient } from '../hasura-auth'
import { StorageGetter, StorageSetter } from '../storage'
import { isValidEmail, isValidPassword } from '../validators'

import { AutoLoginOption, createAutoLoginMachine } from './auto-login'
import { INITIAL_MACHINE_CONTEXT, NhostContext } from './context'
import { NhostEvents } from './events'

export type { NhostContext, NhostEvents }
export * from './change-email'
export * from './change-password'
export * from './reset-password'

export type NhostMachineOptions = {
  backendUrl: string
  clientUrl?: string
  storageGetter?: StorageGetter
  storageSetter?: StorageSetter
  autoLogin?: AutoLoginOption
  autoRefreshToken?: boolean
}

export type NhostMachine = ReturnType<typeof createNhostMachine>

export const createNhostMachine = ({
  backendUrl,
  clientUrl,
  storageSetter,
  storageGetter,
  autoRefreshToken = true,
  autoLogin = true
}: Required<NhostMachineOptions>) => {
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
        context: {} as NhostContext,
        events: {} as NhostEvents
      },
      tsTypes: {} as import('./index.typegen').Typegen0,
      context: produce<NhostContext>(INITIAL_MACHINE_CONTEXT, (ctx) => {
        const expiresAt = storageGetter(NHOST_JWT_EXPIRES_AT_KEY)
        if (expiresAt) ctx.accessToken.expiresAt = new Date(expiresAt)
        ctx.refreshToken.value = storageGetter(NHOST_REFRESH_TOKEN_KEY)
      }),
      id: 'nhost',
      type: 'parallel',
      states: {
        authentication: {
          initial: 'starting',
          invoke: [{ id: 'autoLogin', src: 'autoLogin' }],
          on: {
            TRY_TOKEN: '#nhost.token.running',
            SESSION_UPDATE: [
              {
                cond: 'hasSession',
                actions: ['saveSession', 'persist', 'resetTimer'],
                target: '.signedIn'
              }
            ]
          },
          states: {
            starting: {
              always: [
                {
                  cond: 'isSignedIn',
                  target: 'signedIn'
                },
                {
                  cond: 'hasRefreshTokenWithoutSession',
                  target: ['authenticating.token', '#nhost.token.running']
                },
                'signedOut'
              ]
            },
            signedOut: {
              tags: ['ready'],
              initial: 'noErrors',
              states: {
                noErrors: {},
                success: {},
                needsVerification: {},
                failed: {
                  exit: 'resetAuthenticationError',
                  initial: 'server',
                  states: {
                    server: {
                      entry: 'saveAuthenticationError'
                    },
                    validation: {
                      states: {
                        password: {
                          entry: 'saveInvalidPassword'
                        },
                        email: {
                          entry: 'saveInvalidEmail'
                        }
                      }
                    }
                  }
                },
                signingOut: {
                  entry: 'destroyToken',
                  invoke: {
                    src: 'signout',
                    id: 'signingOut',
                    onDone: 'success',
                    onError: 'failed.server' // TODO save error
                  }
                }
              },
              on: {
                // TODO change input validation - see official xstate form example
                SIGNIN_PASSWORD: [
                  {
                    cond: 'invalidEmail',
                    target: '.failed.validation.email'
                  },
                  {
                    cond: 'invalidPassword',
                    target: '.failed.validation.password'
                  },
                  '#nhost.authentication.authenticating.password'
                ],
                SIGNIN_PASSWORDLESS_EMAIL: [
                  {
                    cond: 'invalidEmail',
                    target: '.failed.validation.email'
                  },
                  '#nhost.authentication.authenticating.passwordlessEmail'
                ],
                SIGNUP_EMAIL_PASSWORD: [
                  {
                    cond: 'invalidEmail',
                    target: '.failed.validation.email'
                  },
                  {
                    cond: 'invalidPassword',
                    target: '.failed.validation.password'
                  },
                  '#nhost.authentication.registering'
                ],
                SIGNIN_ANONYMOUS: '#nhost.authentication.authenticating.anonymous'
              }
            },
            authenticating: {
              states: {
                passwordlessEmail: {
                  invoke: {
                    src: 'signInPasswordlessEmail',
                    id: 'authenticatePasswordlessEmail',
                    onDone: '#nhost.authentication.signedOut.needsVerification',
                    onError: '#nhost.authentication.signedOut.failed.server'
                  }
                },
                password: {
                  invoke: {
                    src: 'signInPassword',
                    id: 'authenticateUserWithPassword',
                    onDone: {
                      actions: ['saveSession', 'persist'],
                      target: '#nhost.authentication.signedIn'
                    },
                    onError: [
                      {
                        cond: 'unverified',
                        target: '#nhost.authentication.signedOut.needsVerification'
                      },
                      {
                        target: '#nhost.authentication.signedOut.failed.server'
                      }
                    ]
                  }
                },
                token: {},
                anonymous: {
                  invoke: {
                    src: 'signInAnonymous',
                    id: 'authenticateAnonymously',
                    onDone: {
                      actions: ['saveSession', 'persist'],
                      target: '#nhost.authentication.signedIn'
                    },
                    onError: '#nhost.authentication.signedOut.failed.server'
                  }
                }
              }
            },
            registering: {
              invoke: {
                src: 'registerUser',
                id: 'registerUser',
                onDone: [
                  {
                    cond: 'hasSession',
                    target: '#nhost.authentication.signedIn',
                    actions: ['saveSession', 'persist']
                  },
                  {
                    target: '#nhost.authentication.signedOut.needsVerification'
                  }
                ],
                onError: [
                  {
                    cond: 'unverified',
                    target: '#nhost.authentication.signedOut.needsVerification'
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
              on: {
                SIGNOUT: '#nhost.authentication.signedOut.signingOut'
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
                              actions: 'tickRefreshTimer',
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
                              actions: ['saveSession', 'persist', 'resetTimer'],
                              target: 'pending'
                            },
                            onError: [
                              // TODO
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
                }
              }
            }
          }
        },
        token: {
          initial: 'idle',
          states: {
            idle: {},
            running: {
              invoke: {
                src: 'refreshToken',
                id: 'authenticateWithToken',
                onDone: {
                  actions: ['saveSession', 'persist'],
                  target: ['#nhost.authentication.signedIn', 'idle']
                },
                onError: {
                  target: ['#nhost.authentication.signedOut', 'idle']
                }
              }
            }
          }
        }
      }
    },
    {
      actions: {
        // TODO better naming
        saveSession: assign({
          // TODO type
          user: (_, e: any) => e.data?.session?.user,
          accessToken: (_, e) => ({
            value: e.data?.session?.accessToken,
            expiresAt: new Date(Date.now() + e.data?.session?.accessTokenExpiresIn * 1_000)
          }),
          refreshToken: (_, e) => ({ value: e.data?.session?.refreshToken }),
          mfa: (_, e) => e.data?.mfa ?? false
        }),

        resetTimer: assign({
          refreshTimer: (ctx, e) => {
            return {
              elapsed: 0,
              attempts: 0
            }
          }
        }),

        tickRefreshTimer: assign({
          refreshTimer: (ctx, e) => {
            return {
              elapsed: ctx.refreshTimer.elapsed + 1,
              attempts: ctx.refreshTimer.attempts
            }
          }
        }),

        // * Authenticaiton errors
        saveAuthenticationError: assign({
          // TODO type
          errors: ({ errors }, { data: { error } }: any) => ({ ...errors, authentication: error })
        }),
        resetAuthenticationError: assign({
          errors: ({ errors: { authentication, ...errors } }) => errors
        }),
        saveInvalidEmail: assign({
          errors: ({ errors }) => ({ ...errors, authentication: INVALID_EMAIL_ERROR })
        }),
        saveInvalidPassword: assign({
          errors: ({ errors }) => ({ ...errors, authentication: INVALID_PASSWORD_ERROR })
        }),

        saveRegisrationError: assign({
          // TODO type
          errors: ({ errors }, { data: { error } }: any) => ({ ...errors, registration: error })
        }),
        // * Persist the refresh token and the jwt expiration outside of the machine
        persist: (_, { data }: any) => {
          storageSetter(NHOST_REFRESH_TOKEN_KEY, data.session.refreshToken)
          if (data.session.accessTokenExpiresIn) {
            const nextRefresh = new Date(
              Date.now() + data.session.accessTokenExpiresIn * 1_000
            ).toISOString()
            storageSetter(NHOST_JWT_EXPIRES_AT_KEY, nextRefresh)
          } else {
            storageSetter(NHOST_JWT_EXPIRES_AT_KEY, null)
          }
        },
        destroyToken: () => {
          storageSetter(NHOST_REFRESH_TOKEN_KEY, null)
          storageSetter(NHOST_JWT_EXPIRES_AT_KEY, null)
        }
      },

      guards: {
        isSignedIn: (ctx) => !!ctx.user && !!ctx.refreshToken.value && !!ctx.accessToken.value,
        hasRefreshTokenWithoutSession: (ctx) =>
          !!ctx.refreshToken.value && !ctx.user && !ctx.accessToken.value,
        noToken: (ctx) => !ctx.refreshToken.value,
        hasRefreshToken: (ctx) => !!ctx.refreshToken.value,
        isAutoRefreshDisabled: () => !autoRefreshToken,
        refreshTimerShouldRefresh: (ctx) =>
          ctx.refreshTimer.elapsed >
          Math.max(
            (Date.now() - ctx.accessToken.expiresAt.getTime()) / 1_000 - TOKEN_REFRESH_MARGIN,
            MIN_TOKEN_REFRESH_INTERVAL
          ),

        // * Authentication errors
        // TODO type
        unverified: (ctx, { data: { error } }: any) =>
          error.status === 401 && error.message === 'Email is not verified',

        // * Event guards
        // TODO type
        hasSession: (_, e: any) => !!e.data?.session,
        invalidEmail: (_, { email }) => !isValidEmail(email),
        invalidPassword: (_, { password }) => !isValidPassword(password)
      },

      services: {
        // TODO options
        signInPassword: (_, { email, password }) =>
          postRequest('/v1/auth/signin/email-password', {
            email,
            password
          }),
        signInPasswordlessEmail: (_, { email, options }) =>
          postRequest('/v1/auth/signin/passwordless/email', {
            email,
            options: {
              ...options,
              redirectTo: options?.redirectTo?.startsWith('/')
                ? clientUrl + options.redirectTo
                : options?.redirectTo
            }
          }),
        signInAnonymous: (_) => postRequest('/v1/auth/signin/anonymous'),
        refreshToken: async (ctx, event) => {
          const refreshToken = event.type === 'TRY_TOKEN' ? event.token : ctx.refreshToken.value
          const session = await postRequest('/v1/auth/token', {
            refreshToken
          })
          return { session }
        },
        signout: (ctx, e) =>
          postRequest('/v1/auth/signout', {
            refreshToken: ctx.refreshToken.value,
            all: !!e.all
          }),

        //   TODO options
        registerUser: (_, { email, password, options }) =>
          postRequest('/v1/auth/signup/email-password', {
            email,
            password,
            options: {
              ...options,
              redirectTo: options?.redirectTo?.startsWith('/')
                ? clientUrl + options.redirectTo
                : options?.redirectTo
            }
          }),

        autoLogin: createAutoLoginMachine({ autoLogin })
      }
    }
  )
}
