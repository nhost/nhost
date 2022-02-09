import { assign as immerAssign } from '@xstate/immer'
import { validate as uuidValidate } from 'uuid'
import { assign, createMachine, send, spawn } from 'xstate'
import { createChangePasswordMachine } from './change-password'
import { createChangeEmailMachine } from './change-email'
import { INITIAL_CONTEXT, NhostContext } from './context'
import { StorageGetter, StorageSetter } from './storage'

import { createBackendServices, AxiosErrorResponseEvent, nhostApiClient } from './backend-services'
import {
  REFRESH_TOKEN_RETRY_INTERVAL,
  TOKEN_REFRESH_MARGIN,
  MIN_TOKEN_REFRESH_INTERVAL,
  NHOST_REFRESH_TOKEN,
  REFRESH_TOKEN_RETRY_MAX_ATTEMPTS
} from './constants'
import produce from 'immer'
import { isValidEmail, isValidPassword } from './validators'

export type NhostInitOptions = {
  backendUrl: string
  storageGetter?: StorageGetter
  storageSetter?: StorageSetter
}

export type NhostMachine = ReturnType<typeof nhostMachineWithConfig>

export const nhostMachineWithConfig = ({
  backendUrl,
  storageSetter,
  storageGetter
}: Required<NhostInitOptions>) => {
  const api = nhostApiClient(backendUrl)

  // TODO improve event types
  return createMachine<NhostContext, any>(
    {
      context: produce(INITIAL_CONTEXT, (ctx) => {
        ctx.refreshToken.value = storageGetter(NHOST_REFRESH_TOKEN)
      }),
      id: 'nhost',
      type: 'parallel',
      states: {
        authentication: {
          initial: 'signedOut',
          states: {
            signedOut: {
              initial: 'noErrors',
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
                    {
                      target: '#nhost.authentication.signedOut.failed.other'
                    }
                  ]
                },
                failed: {
                  exit: 'resetAuthenticationError',
                  initial: 'other',
                  states: {
                    other: {},
                    network: {},
                    existingUser: {},
                    unauthorized: {}
                  }
                }
              },
              always: {
                cond: 'isUserSet',
                target: '#nhost.authentication.signedIn'
              },
              on: {
                SIGNIN_PASSWORD: [
                  {
                    cond: 'invalidEmail',
                    target: '#nhost.authentication.signedOut.invalidEmail'
                  },
                  {
                    cond: 'invalidPassword',
                    target: '#nhost.authentication.signedOut.invalidPassword'
                  },
                  {
                    actions: ['saveEmail', 'savePassword'],
                    target: '#nhost.authentication.authenticating.password'
                  }
                ],
                SIGNIN_PASSWORDLESS_EMAIL: [
                  {
                    cond: 'invalidEmail',
                    target: '#nhost.authentication.signedOut.invalidEmail'
                  },
                  {
                    actions: 'saveEmail',
                    target: '#nhost.authentication.authenticating.passwordlessEmail'
                  }
                ],
                REGISTER: [
                  {
                    cond: 'invalidEmail',
                    target: '#nhost.authentication.signedOut.invalidEmail'
                  },
                  {
                    cond: 'invalidPassword',
                    target: '#nhost.authentication.signedOut.invalidPassword'
                  },
                  {
                    actions: ['saveEmail', 'savePassword'],
                    target: '#nhost.authentication.registering'
                  }
                ]
              }
            },
            authenticating: {
              exit: 'clearForm',
              states: {
                passwordlessEmail: {
                  invoke: {
                    src: 'signInPasswordlessEmail',
                    id: 'authenticatePasswordlessEmail',
                    onDone: [
                      {
                        target: '#nhost.authentication.signedOut.awaitingVerification'
                      }
                    ],
                    onError: [
                      {
                        actions: 'saveAuthenticationError',
                        target: '#nhost.authentication.signedOut.failing'
                      }
                    ]
                  }
                },
                password: {
                  invoke: {
                    src: 'signInPassword',
                    id: 'authenticateUserWithPassword',
                    onDone: [
                      {
                        actions: 'saveUser',
                        target: '#nhost.authentication.signedIn'
                      }
                    ],
                    onError: [
                      {
                        actions: 'saveAuthenticationError',
                        target: '#nhost.authentication.signedOut.failing'
                      }
                    ]
                  }
                }
              }
            },
            registering: {
              exit: 'clearForm',
              invoke: {
                src: 'registerUser',
                id: 'registerUser',
                onDone: [
                  {
                    actions: 'saveUser',
                    cond: 'hasUser',
                    target: '#nhost.authentication.signedIn'
                  },
                  {
                    target: '#nhost.authentication.authenticating.password'
                  }
                ],
                onError: [
                  {
                    actions: 'saveAuthenticationError',
                    target: '#nhost.authentication.signedOut.failing'
                  }
                ]
              }
            },
            signedIn: {
              type: 'parallel',
              entry: ['persistRefreshToken', 'assignSignedinMachines'],
              on: {
                SIGNOUT: {
                  target: '#nhost.authentication.signingOut'
                }
              },
              states: {
                changeEmail: {
                  initial: 'idle',
                  states: {
                    idle: {
                      initial: 'noErrors',
                      states: {
                        noErrors: {},
                        invalid: {},
                        success: {},
                        needsVerification: {},
                        failed: {
                          exit: 'resetEmailChangeError'
                        }
                      },
                      on: {
                        CHANGE_EMAIL: {
                          actions: 'requestEmailChange'
                        },
                        CHANGE_EMAIL_LOADING: 'running',
                        CHANGE_EMAIL_INVALID: 'idle.invalid'
                      }
                    },
                    running: {
                      on: {
                        CHANGE_EMAIL_SUCCESS: 'idle.needsVerification',
                        CHANGE_EMAIL_ERROR: {
                          target: 'idle.failed',
                          actions: 'saveEmailChangeError'
                        }
                      }
                    }
                  }
                },
                changePassword: {
                  initial: 'idle',
                  states: {
                    idle: {
                      initial: 'noErrors',
                      states: {
                        noErrors: {},
                        invalid: {},
                        success: {},
                        failed: {
                          exit: 'resetPasswordChangeError'
                        }
                      },
                      on: {
                        CHANGE_PASSWORD: {
                          actions: 'requestPasswordChange'
                        },
                        CHANGE_PASSWORD_LOADING: 'running',
                        CHANGE_PASSWORD_INVALID: 'idle.invalid'
                      }
                    },
                    running: {
                      on: {
                        CHANGE_PASSWORD_SUCCESS: 'idle.success',
                        CHANGE_PASSWORD_ERROR: {
                          target: 'idle.failed',
                          actions: 'savePasswordChangeError'
                        }
                      }
                    }
                  }
                }
              }
            },
            signingOut: {
              exit: 'persistRefreshToken',
              invoke: {
                src: 'signout',
                id: 'signingOut',
                onDone: [
                  {
                    actions: 'resetSession',
                    target: '#nhost.authentication.signedOut'
                  }
                ],
                onError: [
                  {
                    actions: 'resetSession',
                    target: '#nhost.authentication.signedOut'
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
                target: '#nhost.tokenRefresher.idle'
              }
            },
            idle: {
              always: {
                cond: 'shouldStartTokenTimer',
                target: '#nhost.tokenRefresher.pending'
              }
            },
            pending: {
              after: {
                '1000': {
                  actions: 'tickTokenRefresher',
                  target: '#nhost.tokenRefresher.pending'
                }
              },
              always: {
                cond: 'shouldRefreshToken',
                target: '#nhost.tokenRefresher.refreshing'
              },
              on: {
                SIGNOUT: {
                  actions: 'resetTokenRefresher',
                  target: '#nhost.tokenRefresher.stopped'
                }
              }
            },
            refreshing: {
              invoke: {
                src: 'refreshToken',
                id: 'refreshToken',
                onDone: [
                  {
                    actions: ['saveToken', 'resetTokenRefresher'],
                    target: '#nhost.tokenRefresher.refreshed'
                  }
                ],
                onError: [
                  {
                    actions: 'retryTokenRefresh',
                    cond: 'canRetryTokenRefresh',
                    target: '#nhost.tokenRefresher.pending'
                  },
                  {
                    actions: ['saveTokenTimerError', 'resetTokenRefresher'],
                    target: '#nhost.tokenRefresher.failing'
                  }
                ]
              }
            },
            failing: {
              always: [
                {
                  cond: 'tokenRefresherNetworkError',
                  target: '#nhost.tokenRefresher.failed.network'
                },
                {
                  target: '#nhost.tokenRefresher.failed'
                }
              ]
            },
            refreshed: {
              entry: 'persistRefreshToken',
              always: {
                target: '#nhost.tokenRefresher.pending'
              }
            },
            failed: {
              exit: 'resetTokenRefresherError',
              initial: 'other',
              states: {
                other: {},
                network: {}
              }
            }
          }
        },
        newRefreshToken: {
          initial: 'idle',
          states: {
            idle: {
              initial: 'noErrors',
              states: {
                noErrors: {},
                failed: {
                  exit: 'resetNewTokenError',
                  initial: 'other',
                  states: {
                    other: {},
                    network: {}
                  }
                },
                invalid: {}
              },
              on: {
                UPDATE_REFRESH_TOKEN: [
                  {
                    cond: 'invalidRefreshToken',
                    target: '#nhost.newRefreshToken.idle.invalid'
                  },
                  {
                    target: '#nhost.newRefreshToken.validating'
                  }
                ]
              }
            },
            validating: {
              invoke: {
                src: 'validateNewToken',
                onDone: [
                  {
                    actions: ['saveToken', 'resetTokenRefresher'],
                    target: '#nhost.newRefreshToken.validated'
                  }
                ],
                onError: [
                  {
                    actions: 'saveNewTokenError',
                    target: '#nhost.newRefreshToken.failing'
                  }
                ]
              }
            },
            validated: {
              exit: 'persistRefreshToken',
              always: {
                target: '#nhost.newRefreshToken.idle'
              }
            },
            failing: {
              always: [
                {
                  cond: 'newTokenNetworkError',
                  target: '#nhost.newRefreshToken.idle.failed.network'
                },
                {
                  target: '#nhost.newRefreshToken.idle.failed'
                }
              ]
            }
          }
        }
      }
    },
    {
      // TODO type events in actions
      actions: {
        // * Persist the refresh token outside of the machine
        persistRefreshToken: (ctx) => {
          storageSetter(NHOST_REFRESH_TOKEN, ctx.refreshToken.value)
        },

        // * 'Token timer' errors
        resetTokenRefresherError: immerAssign((ctx) => {
          ctx.refreshToken.timer.error = null
        }),
        saveTokenTimerError: immerAssign<NhostContext, AxiosErrorResponseEvent>(
          (ctx, { data: { error } }) => {
            ctx.refreshToken.timer.error = error
          }
        ),
        // * Refresh token timer
        resetTokenRefresher: immerAssign((ctx) => {
          ctx.refreshToken.timer.elapsed = 0
          ctx.refreshToken.timer.attempts = 0
        }),
        tickTokenRefresher: immerAssign((ctx) => {
          ctx.refreshToken.timer.elapsed += 1
        }),
        retryTokenRefresh: immerAssign((ctx) => {
          ctx.accessToken.expiresIn = REFRESH_TOKEN_RETRY_INTERVAL
          ctx.refreshToken.timer.elapsed = 0
          ctx.refreshToken.timer.attempts += 1
        }),

        resetNewTokenError: immerAssign((ctx) => {
          ctx.refreshToken.newToken.error = null
        }),
        saveNewTokenError: immerAssign<NhostContext, AxiosErrorResponseEvent>(
          (ctx, { data: { error } }) => {
            ctx.refreshToken.newToken.error = error
          }
        ),

        // * Save information after receiving token information
        saveToken: immerAssign((ctx, e) => {
          ctx.user = e.data.user
          ctx.accessToken.value = e.data.accessToken
          ctx.accessToken.expiresIn = Math.max(
            e.data.accessTokenExpiresIn - TOKEN_REFRESH_MARGIN,
            MIN_TOKEN_REFRESH_INTERVAL
          )
          ctx.refreshToken.value = e.data.refreshToken
        }),

        // * Form
        clearForm: immerAssign((ctx) => {
          ctx.email = undefined
          ctx.password = undefined
        }),
        saveEmail: immerAssign((ctx, e) => {
          ctx.email = e.email
        }),
        savePassword: immerAssign((ctx, e) => {
          ctx.password = e.password
        }),

        resetSession: immerAssign<NhostContext>((ctx) => {
          ctx.user = null
          ctx.mfa = false
          ctx.accessToken.value = null
          ctx.refreshToken.value = null
        }),

        // * Save information received after registration or login
        saveUser: immerAssign((ctx, e) => {
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
        saveAuthenticationError: immerAssign<NhostContext, AxiosErrorResponseEvent>(
          (ctx, { data: { error } }) => {
            ctx.error = error
          }
        ),
        resetAuthenticationError: immerAssign((ctx) => {
          ctx.error = null
        }),

        // * Spawn machines when signed up
        assignSignedinMachines: assign({
          changePasswordMachine: (_) => spawn(createChangePasswordMachine(api), 'changePassword'),
          changeEmailMachine: (_) => spawn(createChangeEmailMachine(api), 'changeEmail')
        }),

        // * Change password
        requestPasswordChange: send<any, any>(
          (ctx, { password }) => ({
            type: 'REQUEST_CHANGE',
            password,
            accessToken: ctx.accessToken.value
          }),
          {
            to: (ctx) => ctx.changePasswordMachine
          }
        ),
        savePasswordChangeError: assign<NhostContext, ErrorEvent>({
          newPassword: (_, { error }) => error
        }),
        resetPasswordChangeError: assign<NhostContext>({
          newPassword: () => null
        }),

        // * Change email
        requestEmailChange: send<any, any>(
          (ctx, { email }) => ({
            type: 'REQUEST_CHANGE',
            email,
            accessToken: ctx.accessToken.value
          }),
          {
            to: (ctx) => ctx.changeEmailMachine
          }
        ),
        saveEmailChangeError: assign<NhostContext, ErrorEvent>({
          newPassword: (_, { error }) => error
        }),
        resetEmailChangeError: assign<NhostContext>({
          newPassword: () => null
        })
      },

      guards: {
        isUserSet: (ctx) => !!ctx.user,
        // * Authentication errors
        unverified: (ctx) =>
          ctx.error?.status === 401 && ctx.error.message === 'Email is not verified',
        existingUser: (ctx) => ctx.error?.status === 409,
        unauthorized: (ctx) => ctx.error?.status === 401,
        networkError: (ctx, e) => ctx.error?.status === 0,
        // * New refresh token errors
        newTokenNetworkError: (ctx) => ctx.refreshToken.newToken.error?.status === 0,
        // TODO type event
        invalidRefreshToken: (_, e) => !uuidValidate(e.token),
        // * Context guards
        shouldStartTokenTimer: (ctx) => !!ctx.refreshToken.value,
        shouldWaitForToken: (ctx) => !ctx.refreshToken.value,
        shouldRefreshToken: (ctx) =>
          ctx.refreshToken.timer.elapsed >= ctx.accessToken.expiresIn || !ctx.user,
        // * Refresh token timer errors
        tokenRefresherNetworkError: (ctx) => ctx.refreshToken.timer.error?.status === 0,
        // can retry token refresh only if number of attempts is not reached, and there is a network error
        canRetryTokenRefresh: (ctx, event: AxiosErrorResponseEvent) => {
          const remainingAttempts =
            ctx.refreshToken.timer.attempts < REFRESH_TOKEN_RETRY_MAX_ATTEMPTS
          const isNetworkError = event.data.error.status === 0
          return remainingAttempts && isNetworkError
        },
        // * Event guards
        // TODO type event
        hasUser: (_, e) => !!e.data.session,
        // TODO type event
        invalidEmail: (_, { email }) => !isValidEmail(email),
        // TODO type event
        invalidPassword: (_, { password }) => !isValidPassword(password)
      },
      services: { ...createBackendServices(api) }
    }
  )
}
