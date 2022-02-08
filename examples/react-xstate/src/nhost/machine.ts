import { createMachine } from 'xstate'
import { assign } from '@xstate/immer'
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
import { createBackendServices } from './backend-services'

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
                failing: {
                  always: [
                    {
                      cond: 'networkError',
                      target: '#nhost.authentication.signedOut.failed.network'
                    },
                    {
                      cond: 'existingUser',
                      target: '#nhost.authentication.signedOut.failed.existingUser'
                    },
                    {
                      cond: 'unverified',
                      target: '#nhost.authentication.signedOut.awaitingVerification'
                    },
                    {
                      cond: 'unauthorized',
                      target: '#nhost.authentication.signedOut.failed.unauthorized'
                    },
                    { target: '#nhost.authentication.signedOut.failed.unkwown' }
                  ]
                },
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
                    onDone: '#nhost.authentication.signedOut.awaitingVerification',
                    onError: {
                      target: '#nhost.authentication.signedOut.failing',
                      actions: 'saveError'
                    }
                  }
                },
                password: {
                  invoke: {
                    id: 'authenticateUserWithPassword',
                    src: 'signInPassword',
                    onDone: {
                      target: '#nhost.authentication.signedIn',
                      actions: 'saveUser'
                    },
                    onError: {
                      target: '#nhost.authentication.signedOut.failing',
                      actions: 'saveError'
                    }
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
                onError: {
                  target: 'signedOut.failing',
                  actions: 'saveError'
                }
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
        saveError: assign((ctx, { data: { error } }) => {
          ctx.error = error
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
      // TODO type events in guards
      guards: {
        // * Context guards
        shouldStartTokenTimer: (ctx) => !!ctx.refreshToken.value,
        shouldWaitForToken: (ctx) => !ctx.refreshToken.value,
        shouldRefreshToken: (ctx) =>
          ctx.refreshToken.timer.elapsed >= ctx.accessToken.expiresIn || !ctx.user,
        isUserSet: (ctx) => !!ctx.user,
        unverified: (ctx) =>
          ctx.error?.status === 401 && ctx.error.message === 'Email is not verified',
        existingUser: (ctx) => ctx.error?.status === 409,
        unauthorized: (ctx) => ctx.error?.status === 401,
        networkError: (ctx, e) => ctx.error?.status === 0,

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
        ...createBackendServices(backendUrl),
        // TODO use xstate 'delay' builtin
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
