import { createMachine } from 'xstate'
import { assign } from '@xstate/immer'
import { produce } from 'immer'
import axios from 'axios'
import { validate as uuidValidate } from 'uuid'

export const REFRESH_TOKEN_KEY = 'refresh-token'

const DEFAULT_TOKEN_EXPIRATION = 900
const MIN_PASSWORD_LENGTH = 3

// * Minimum number of seconds before the JWT expiration and the refresh
const TOKEN_REFRESH_MARGIN = 900
// const TOKEN_REFRESH_MARGIN = 180
const MIN_TOKEN_REFRESH_INTERVAL = 60
// const MIN_TOKEN_REFRESH_INTERVAL = 10
const REFRESH_TOKEN_RETRY_INTERVAL = 10
// const REFRESH_TOKEN_RETRY_INTERVAL = 5
const REFRESH_TOKEN_RETRY_MAX_ATTEMPTS = 30
// const REFRESH_TOKEN_RETRY_MAX_ATTEMPTS = 10

type User = Record<string, unknown>
type NhostContext = {
  user?: User
  mfa?: boolean
  accessToken: { value?: string; expiresIn: number }
  refreshToken: { value?: string | null; timer: { elapsed: number; attempts: number } }
  error?: unknown
  email?: string
  password?: string
}

const initialContext: NhostContext = {
  user: undefined,
  mfa: undefined,
  accessToken: {
    value: undefined,
    expiresIn: DEFAULT_TOKEN_EXPIRATION
  },
  refreshToken: {
    value: undefined,
    timer: {
      elapsed: 0,
      attempts: 0
    }
  },
  error: undefined,
  email: undefined,
  password: undefined
}

type NhostMachineOptions = { endpoint: string }
export type NhostMachine = ReturnType<typeof createNhostMachine>

export const createNhostMachine = ({ endpoint }: NhostMachineOptions) => {
  return createMachine<NhostContext>(
    {
      id: 'authentication',
      type: 'parallel',
      context: produce(initialContext, (ctx) => {
        ctx.refreshToken.value = localStorage.getItem(REFRESH_TOKEN_KEY)
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
                    target: 'authenticating',
                    actions: ['saveEmail', 'savePassword']
                  }
                ],
                SIGNIN_PASSWORDLESS_EMAIL: [
                  {
                    target: '.ininvalidEmail',
                    cond: 'invalidEmail'
                  },
                  {
                    target: 'authenticating',
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
              invoke: {
                id: 'authenticateUser',
                src: 'signIn',
                onDone: [
                  {
                    cond: 'hasUser',
                    target: 'signedIn',
                    actions: ['saveUser', 'clearForm']
                  },
                  {
                    target: 'signedOut.awaitingVerification'
                  }
                  // TODO other authentication methods
                ],
                onError: [
                  {
                    cond: 'networkError',
                    target: 'signedOut.failed.network',
                    actions: ['saveError']
                  },
                  {
                    cond: 'unverified',
                    target: 'signedOut.awaitingVerification',
                    actions: 'saveError'
                  },
                  {
                    cond: 'unauthorized',
                    target: 'signedOut.failed.unauthorized',
                    actions: 'saveError'
                  },
                  {
                    target: 'signedOut.failed',
                    actions: 'saveError'
                  }
                ]
              }
            },
            registering: {
              invoke: {
                id: 'registerUser',
                src: 'registerUser',
                onDone: [
                  {
                    target: 'signedIn',
                    cond: 'hasUser',
                    actions: ['saveUser', 'clearForm']
                  },
                  { target: 'authenticating', actions: ['clearForm'] }
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
              }
            },
            signedIn: {
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
              }
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
                  target: 'pending',
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
          ctx.user = undefined
          ctx.mfa = undefined
          ctx.accessToken.value = undefined
          ctx.refreshToken.value = undefined
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
        })
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
        signIn: async ({ email, password }) => {
          //   TODO options
          if (password) {
            const { data } = await axios.post(`${endpoint}/v1/auth/signin/email-password`, {
              email,
              password
            })
            return data
          } else {
            const { data } = await axios.post(`${endpoint}/v1/auth/signin/passwordless/email`, {
              email
            })
            return data
          }
        },
        signout: async (ctx, e) => {
          await axios.post(`${endpoint}/v1/auth/signout`, {
            refreshToken: ctx.refreshToken.value,
            all: !!e.all
          })
        },

        registerUser: async ({ email, password }) => {
          //   TODO options
          const { data } = await axios.post(`${endpoint}/v1/auth/signup/email-password`, {
            email,
            password
          })
          return data
        },

        refreshToken: async ({ refreshToken: { value } }) => {
          const { data } = await axios.post(`${endpoint}/v1/auth/token`, {
            refreshToken: value
          })
          return data
        },

        validateNewToken: async (_, event) => {
          const { data } = await axios.post(`${endpoint}/v1/auth/token`, {
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
