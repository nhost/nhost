import { createMachine } from 'xstate'
import { assign } from '@xstate/immer'
import axios from 'axios'
import { validate as uuidValidate } from 'uuid'
import produce from 'immer'
import { defaultStorageGetter, defaultStorageSetter, StorageGetter, StorageSetter } from './storage'
import { INTIAL_CONTEXT, NhostContext } from './context'
import {
  MIN_PASSWORD_LENGTH,
  MIN_TOKEN_REFRESH_INTERVAL,
  NHOST_REFRESH_TOKEN,
  REFRESH_TOKEN_RETRY_INTERVAL,
  REFRESH_TOKEN_RETRY_MAX_ATTEMPTS,
  TOKEN_REFRESH_MARGIN
} from './constants'

export type NhostMachineOptions = {
  backendUrl: string
  storageGetter?: StorageGetter
  storageSetter?: StorageSetter
}

export type NhostMachine = ReturnType<typeof createNhostMachine>

export const createNhostMachine = ({
  backendUrl,
  storageGetter = defaultStorageGetter,
  storageSetter = defaultStorageSetter
}: NhostMachineOptions) => {
  return createMachine<NhostContext>(
    {
      id: 'nhost',
      type: 'parallel',
      context: produce(INTIAL_CONTEXT, (ctx) => {
        ctx.refreshToken.value = storageGetter(NHOST_REFRESH_TOKEN)
      }),
      states: {
        authentication: {
          initial: 'signedOut',
          states: {
            signedOut: {
              initial: 'noErrors',
              always: [
                {
                  target: 'signedIn',
                  cond: 'isUserSet'
                }
              ],
              on: {
                SIGNIN: [
                  {
                    target: '.ininvalidEmail',
                    cond: 'invalidEmail'
                  },
                  {
                    target: '.ininvalidPassword',
                    cond: 'invalidPassword'
                  },
                  {
                    target: 'authenticating.password',
                    actions: ['saveEmail', 'savePassword']
                  }
                ],
                SIGNIN_PASSWORDLESS_EMAIL: [
                  {
                    target: '.ininvalidEmail',
                    cond: 'invalidEmail'
                  },
                  {
                    target: 'authenticating.passwordless',
                    actions: 'saveEmail'
                  }
                ],
                REGISTER: [
                  {
                    target: '.ininvalidEmail',
                    cond: 'invalidEmail'
                  },
                  {
                    target: '.ininvalidPassword',
                    cond: 'invalidPassword'
                  },
                  {
                    target: 'registering',
                    actions: ['saveEmail', 'savePassword']
                  }
                ]
              },
              states: {
                noErrors: {},
                ininvalidEmail: {},
                ininvalidPassword: {},
                awaitingVerification: {},
                failed: {
                  initial: 'unkwown',
                  states: {
                    unkwown: {},
                    network: {},
                    existingUser: {},
                    unauthorized: {}
                  }
                }
              }
            },
            authenticating: {
              states: {
                passwordless: {
                  invoke: {
                    id: 'authenticatePasswordlessEmail',
                    src: 'signInPasswordlessEmail',
                    onDone: [
                      {
                        target: '#nhost.authentication.signedOut.awaitingVerification'
                      }
                    ],
                    onError: [
                      {
                        cond: 'networkError',
                        target: '#nhost.authentication.signedOut.failed.network',
                        actions: 'saveError'
                      },
                      {
                        cond: 'unauthorized',
                        target: '#nhost.authentication.signedOut.failed.unauthorized',
                        actions: 'saveError'
                      },
                      {
                        target: '#nhost.authentication.signedOut.failed',
                        actions: 'saveError'
                      }
                    ]
                  }
                },
                password: {
                  invoke: {
                    id: 'authenticateUserWithPassword',
                    src: 'signInPassword',
                    onDone: [
                      {
                        target: '#nhost.authentication.signedIn',
                        actions: 'saveUser'
                      }
                    ],
                    onError: [
                      {
                        cond: 'networkError',
                        target: '#nhost.authentication.signedOut.failed.network',
                        actions: ['saveError']
                      },
                      {
                        cond: 'unverified',
                        target: '#nhost.authentication.signedOut.awaitingVerification',
                        actions: 'saveError'
                      },
                      {
                        cond: 'unauthorized',
                        target: '#nhost.authentication.signedOut.failed.unauthorized',
                        actions: 'saveError'
                      },
                      {
                        target: '#nhost.authentication.signedOut.failed',
                        actions: 'saveError'
                      }
                    ]
                  }
                }
              },
              exit: ['clearForm']
            },
            registering: {
              invoke: {
                id: 'registerUser',
                src: 'registerUser',
                onDone: [
                  {
                    target: 'signedIn',
                    cond: 'hasUser',
                    actions: ['saveUser']
                  },
                  { target: 'authenticating.password' }
                ],
                onError: [
                  {
                    cond: 'existingUser',
                    target: 'signedOut.failed.existingUser',
                    actions: 'saveError'
                  },
                  {
                    target: 'signedOut.failed',
                    actions: 'saveError'
                  }
                ]
              },
              exit: ['clearForm']
            },
            signedIn: {
              entry: ['persistRefreshToken'],
              on: {
                SIGNOUT: {
                  target: 'signingOut'
                }
              }
            },
            signingOut: {
              invoke: {
                id: 'signingOut',
                src: 'signout',
                onDone: {
                  target: 'signedOut',
                  actions: 'resetSession'
                },
                onError: { target: 'signedOut', actions: 'resetSession' }
              },
              exit: ['persistRefreshToken']
            }
          }
        },
        newRefreshToken: {
          initial: 'standby',
          states: {
            standby: {
              initial: 'noErrors',
              on: {
                UPDATE_REFRESH_TOKEN: [
                  {
                    cond: 'invalidRefreshToken',
                    target: '.invalid'
                  },
                  { target: 'validating' }
                ]
              },
              states: {
                noErrors: {},
                error: {},
                invalid: {},
                network: {}
              }
            },
            validating: {
              invoke: {
                src: 'validateNewToken',
                onDone: {
                  target: 'standby',
                  actions: ['saveToken', 'resetRefreshTokenTimer']
                },
                onError: [
                  {
                    target: 'standby.network',
                    cond: 'networkError'
                  },
                  {
                    target: 'standby.error'
                  }
                ]
              }
            }
          }
        },
        tokenRefresher: {
          initial: 'idle',
          states: {
            stopped: {
              always: {
                cond: 'shouldWaitForToken',
                target: 'idle'
              }
            },
            idle: {
              always: [
                {
                  cond: 'shouldStartTokenTimer',
                  target: 'pending'
                }
              ]
            },
            pending: {
              invoke: {
                src: 'startTokenTimer'
              },
              always: [
                {
                  cond: 'shouldRefreshToken',
                  target: 'refreshing'
                }
              ],
              on: {
                TICK: {
                  actions: 'tickTokenTimer'
                },
                SIGNOUT: {
                  target: 'stopped',
                  actions: 'resetRefreshTokenTimer'
                }
              }
            },
            refreshing: {
              invoke: {
                id: 'refreshToken',
                src: 'refreshToken',
                onDone: {
                  target: 'refreshed',
                  actions: ['saveToken', 'resetRefreshTokenTimer']
                },
                onError: [
                  {
                    target: 'pending',
                    cond: 'canRetryTokenRefresh',
                    actions: 'retryTokenRefresh'
                  },
                  {
                    target: 'failed.network',
                    cond: 'networkError',
                    actions: 'resetRefreshTokenTimer'
                  },
                  {
                    target: 'failed',
                    actions: 'resetRefreshTokenTimer'
                  }
                ]
              }
            },
            refreshed: {
              always: {
                target: 'pending'
              },
              entry: 'persistRefreshToken'
            },
            failed: {
              initial: 'invalid',
              states: {
                invalid: {},
                network: {}
              }
            }
          }
        }
      }
    },
    {
      actions: {
        clearForm: assign((ctx) => {
          ctx.email = undefined
          ctx.password = undefined
        }),
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
        saveToken: assign((ctx, e) => {
          ctx.user = e.data.user
          ctx.accessToken.value = e.data.accessToken
          ctx.accessToken.expiresIn = Math.max(
            e.data.accessTokenExpiresIn - TOKEN_REFRESH_MARGIN,
            MIN_TOKEN_REFRESH_INTERVAL
          )
          ctx.refreshToken.value = e.data.refreshToken
        }),
        saveError: assign((ctx, { data: { response, request } }) => {
          ctx.error = {
            error: response?.data.error || request.statusText || 'network',
            message: response?.data.message || request.responseText || 'Network error',
            statusCode: response?.data.statusCode || request.status || 0
          }
        }),
        saveEmail: assign((ctx, e) => {
          ctx.email = e.email
        }),
        savePassword: assign((ctx, e) => {
          ctx.password = e.password
        }),
        resetSession: assign((ctx) => {
          ctx.user = null
          ctx.mfa = false
          ctx.accessToken.value = null
          ctx.refreshToken.value = null
        }),
        resetRefreshTokenTimer: assign((ctx) => {
          ctx.refreshToken.timer.elapsed = 0
          ctx.refreshToken.timer.attempts = 0
        }),
        tickTokenTimer: assign((ctx) => {
          ctx.refreshToken.timer.elapsed += 1 // * One second
        }),
        retryTokenRefresh: assign((ctx) => {
          ctx.accessToken.expiresIn = REFRESH_TOKEN_RETRY_INTERVAL
          ctx.refreshToken.timer.elapsed = 0
          ctx.refreshToken.timer.attempts += 1
        }),
        persistRefreshToken: (ctx) => {
          storageSetter(NHOST_REFRESH_TOKEN, ctx.refreshToken.value)
        }
      },
      guards: {
        // * Context guards
        shouldStartTokenTimer: (ctx) => !!ctx.refreshToken.value,
        shouldWaitForToken: (ctx) => !ctx.refreshToken.value,
        shouldRefreshToken: (ctx) =>
          ctx.refreshToken.timer.elapsed >= ctx.accessToken.expiresIn || !ctx.user,
        isUserSet: (ctx) => !!ctx.user,

        // * Hybrid guards
        // can retry token refresh only if number of attempts is not reached, and there is a network error
        canRetryTokenRefresh: (ctx, event) => {
          const remainingAttempts =
            ctx.refreshToken.timer.attempts < REFRESH_TOKEN_RETRY_MAX_ATTEMPTS
          const isNetworkError = !event.data.response && !event.data.request.status
          return remainingAttempts && isNetworkError
        },

        // * Event guards
        hasUser: (_, e) => !!e.data.session,
        unverified: (_, e) =>
          e.data.response?.data?.statusCode === 401 &&
          e.data.response?.data?.message === 'Email is not verified',
        existingUser: (_, e) => e.data.response?.data.statusCode === 409,
        unauthorized: (_, e) => e.data.response?.data.statusCode === 401,
        networkError: (_, e) => !e.data.response && !e.data.request.status,
        invalidEmail: (_, e) =>
          !String(e.email)
            .toLowerCase()
            .match(
              /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            ),
        invalidPassword: (_, e) => e.password.length <= MIN_PASSWORD_LENGTH,
        invalidRefreshToken: (_, e) => !uuidValidate(e.token)
      },
      services: {
        signInPassword: async ({ email, password }) => {
          //   TODO options
          console.log(email, password)
          const { data } = await axios.post(`${backendUrl}/v1/auth/signin/email-password`, {
            email,
            password
          })
          return data
        },
        signInPasswordlessEmail: async ({ email }) => {
          //   TODO options
          console.log('passwordless', email)
          const { data } = await axios.post(`${backendUrl}/v1/auth/signin/passwordless/email`, {
            email
          })
          return data
        },
        signout: async (ctx, e) => {
          await axios.post(`${backendUrl}/v1/auth/signout`, {
            refreshToken: ctx.refreshToken.value,
            all: !!e.all
          })
        },

        registerUser: async ({ email, password }) => {
          //   TODO options
          const { data } = await axios.post(`${backendUrl}/v1/auth/signup/email-password`, {
            email,
            password
          })
          return data
        },

        refreshToken: async ({ refreshToken: { value } }) => {
          const { data } = await axios.post(`${backendUrl}/v1/auth/token`, {
            refreshToken: value
          })
          return data
        },

        validateNewToken: async (_, event) => {
          const { data } = await axios.post(`${backendUrl}/v1/auth/token`, {
            refreshToken: event.token
          })
          return data
        },

        startTokenTimer: () => (cb) => {
          const interval = setInterval(
            () => cb('TICK'),
            1000 // * One tick per second
          )
          return () => clearInterval(interval)
        }
      }
    }
  )
}
