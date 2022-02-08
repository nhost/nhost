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
                    target: '.invalidEmail',
                    cond: 'invalidEmail'
                  },
                  {
                    target: '.invalidPassword',
                    cond: 'invalidPassword'
                  },
                  {
                    target: 'authenticating.password',
                    actions: ['saveEmail', 'savePassword']
                  }
                ],
                SIGNIN_PASSWORDLESS_EMAIL: [
                  {
                    target: '.invalidEmail',
                    cond: 'invalidEmail'
                  },
                  {
                    target: 'authenticating.passwordlessEmail',
                    actions: 'saveEmail'
                  }
                ],
                REGISTER: [
                  {
                    target: '.invalidEmail',
                    cond: 'invalidEmail'
                  },
                  {
                    target: '.invalidPassword',
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
                invalidEmail: {},
                invalidPassword: {},
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
                    { target: '#nhost.authentication.signedOut.failed.other' }
                  ]
                },
                failed: {
                  initial: 'other',
                  states: {
                    other: {},
                    network: {},
                    existingUser: {},
                    unauthorized: {}
                  },
                  exit: 'resetAuthenticationError'
                }
              }
            },
            authenticating: {
              states: {
                passwordlessEmail: {
                  invoke: {
                    id: 'authenticatePasswordlessEmail',
                    src: 'signInPasswordlessEmail',
                    onDone: '#nhost.authentication.signedOut.awaitingVerification',
                    onError: {
                      target: '#nhost.authentication.signedOut.failing',
                      actions: 'saveAuthenticationError'
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
                      actions: 'saveAuthenticationError'
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
                  actions: 'saveAuthenticationError'
                }
              },
              exit: 'clearForm'
            },
            signedIn: {
              type: 'parallel',
              entry: ['persistRefreshToken'],
              states: {
                changeEmail: {
                  initial: 'idle',
                  states: {
                    idle: {
                      initial: 'noErrors',
                      on: {
                        CHANGE_EMAIL: [
                          {
                            cond: 'invalidEmail',
                            target: '.invalidEmail'
                          },
                          {
                            target: 'requesting',
                            actions: 'saveEmail'
                          }
                        ]
                      },
                      states: {
                        noErrors: {},
                        failed: {
                          exit: 'resetNewEmailError'
                        },
                        invalidEmail: {}
                      }
                    },

                    requesting: {
                      invoke: {
                        id: 'requestNewEmail',
                        src: 'requestNewEmail',
                        onDone: 'awaitingVerification',
                        onError: {
                          target: 'failing',
                          actions: 'saveNewEmailError'
                        }
                      }
                    },
                    failing: {
                      always: [
                        // TODO capture error types
                        'idle.failed'
                      ]
                    },
                    awaitingVerification: {
                      // TODO change back state to idle when email is verified
                    }
                  }
                }
              },
              on: {
                SIGNOUT: 'signingOut'
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
              exit: 'persistRefreshToken'
            }
          }
        },
        newRefreshToken: {
          initial: 'idle',
          states: {
            idle: {
              initial: 'noErrors',
              on: {
                UPDATE_REFRESH_TOKEN: [
                  {
                    cond: 'invalidRefreshToken',
                    target: '.invalid'
                  },
                  'validating'
                ]
              },
              states: {
                noErrors: {},
                failed: {
                  initial: 'other',
                  exit: 'resetNewTokenError',
                  states: { other: {}, network: {} }
                },
                invalid: {}
              }
            },
            validating: {
              invoke: {
                src: 'validateNewToken',
                onDone: {
                  target: 'validated',
                  actions: ['saveToken', 'resetTokenRefresher']
                },
                onError: {
                  target: 'failing',
                  actions: 'saveNewTokenError'
                }
              }
            },
            validated: {
              exit: 'persistRefreshToken',
              always: 'idle'
            },
            failing: {
              always: [
                {
                  target: 'idle.failed.network',
                  cond: 'newTokenNetworkError'
                },
                'idle.failed'
              ]
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
              after: {
                1000: {
                  actions: 'tickTokenRefresher',
                  target: 'pending'
                }
              },
              always: [
                {
                  cond: 'shouldRefreshToken',
                  target: 'refreshing'
                }
              ],
              on: {
                SIGNOUT: {
                  target: 'stopped',
                  actions: 'resetTokenRefresher'
                }
              }
            },
            refreshing: {
              invoke: {
                id: 'refreshToken',
                src: 'refreshToken',
                onDone: {
                  target: 'refreshed',
                  actions: ['saveToken', 'resetTokenRefresher']
                },
                onError: [
                  {
                    target: 'pending',
                    cond: 'canRetryTokenRefresh',
                    actions: 'retryTokenRefresh'
                  },
                  {
                    target: 'failing',
                    actions: ['saveTokenTimerError', 'resetTokenRefresher']
                  }
                ]
              }
            },
            failing: {
              always: [
                {
                  target: 'failed.network',
                  cond: 'tokenRefresherNetworkError'
                },
                'failed'
              ]
            },
            refreshed: {
              always: {
                target: 'pending'
              },
              entry: 'persistRefreshToken'
            },
            failed: {
              initial: 'other',
              exit: 'resetTokenRefresherError',
              states: {
                other: {},
                network: {}
              }
            }
          }
        }
      }
    },
    {
      actions: {
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

        // * Authenticaiton errors
        saveAuthenticationError: assign((ctx, { data: { error } }) => {
          ctx.error = error
        }),
        resetAuthenticationError: assign((ctx) => {
          ctx.error = null
        }),
        // * 'New email' errors
        saveNewEmailError: assign((ctx, { data: { error } }) => {
          ctx.newEmail.error = error
        }),
        resetNewEmailError: assign((ctx) => {
          ctx.newEmail.error = null
        }),
        // * 'New token' errors
        resetNewTokenError: assign((ctx) => {
          ctx.refreshToken.newToken.error = null
        }),
        saveNewTokenError: assign((ctx, { data: { error } }) => {
          ctx.refreshToken.newToken.error = error
        }),
        // * 'Token timer' errors
        resetTokenRefresherError: assign((ctx) => {
          ctx.refreshToken.timer.error = null
        }),
        saveTokenTimerError: assign((ctx, { data: { error } }) => {
          ctx.refreshToken.timer.error = error
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

        // * Persist the refresh token outside of the machine
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

        // * Authentication errors
        unverified: (ctx) =>
          ctx.error?.status === 401 && ctx.error.message === 'Email is not verified',
        existingUser: (ctx) => ctx.error?.status === 409,
        unauthorized: (ctx) => ctx.error?.status === 401,
        networkError: (ctx, e) => ctx.error?.status === 0,

        // * Refresh token timer errors
        tokenRefresherNetworkError: (ctx, e) => ctx.refreshToken.timer.error?.status === 0,

        // * New refresh token errors
        newTokenNetworkError: (ctx, e) => ctx.refreshToken.newToken.error?.status === 0,
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
      services: createBackendServices(backendUrl)
    }
  )
}
