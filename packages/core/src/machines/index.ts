import { AxiosRequestConfig, AxiosResponse } from 'axios'
import { assign, createMachine, forwardTo, send } from 'xstate'

import { NHOST_REFRESH_TOKEN_KEY } from '../constants'
import { INVALID_EMAIL_ERROR, INVALID_PASSWORD_ERROR } from '../errors'
import { nhostApiClient } from '../hasura-auth'
import { StorageGetter, StorageSetter } from '../storage'
import { isValidEmail, isValidPassword } from '../validators'

import { AutoLoginOption, createAutoLoginMachine } from './auto-login'
import { createChangeEmailMachine } from './change-email'
import { createChangePasswordMachine } from './change-password'
import { INITIAL_MACHINE_CONTEXT, NhostContext } from './context'
import { NhostEvents } from './events'
import { createTokenRefresherMachine } from './token-refresher'

export type { NhostContext, NhostEvents }
export { INITIAL_MACHINE_CONTEXT }

export type NhostMachineOptions = {
  backendUrl: string
  storageGetter?: StorageGetter
  storageSetter?: StorageSetter
  autoLogin?: AutoLoginOption
  autoRefreshToken?: boolean
}

export type NhostMachine = ReturnType<typeof createNhostMachine>

export const createNhostMachine = ({
  backendUrl,
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
      context: {
        ...INITIAL_MACHINE_CONTEXT,
        refreshToken: storageGetter(NHOST_REFRESH_TOKEN_KEY)
      },
      id: 'nhost',
      type: 'parallel',
      states: {
        authentication: {
          initial: 'starting',
          invoke: [
            {
              id: 'tokenRefresher',
              src: 'tokenRefresher'
            },
            { id: 'autoLogin', src: 'autoLogin' }
          ],
          on: {
            TRY_TOKEN: {
              actions: 'forwardToRefresher'
            },
            SESSION_UPDATE: [
              {
                cond: 'hasSession',
                target: '.signedIn'
              },
              '.signedOut'
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
                  cond: 'hasRefreshToken',
                  target: 'authenticating.token'
                },
                'signedOut'
              ]
            },
            signedOut: {
              tags: ['ready'],
              initial: 'noErrors',
              entry: 'saveSession',
              states: {
                noErrors: {},
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
                }
              },
              on: {
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
                REGISTER: [
                  {
                    cond: 'invalidEmail',
                    target: '.failed.validation.email'
                  },
                  {
                    cond: 'invalidPassword',
                    target: '.failed.validation.password'
                  },
                  '#nhost.authentication.registering'
                ]
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
                      actions: ['saveSession', 'emitSession'],
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
                token: {
                  entry: 'emitTryToken',
                  on: {
                    TOKEN_REFRESH_ERROR: { target: '#nhost.authentication.signedOut.failed.server' }
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
                    actions: ['saveSession', 'emitSession']
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
                    target: '#nhost.authentication.signedOut.failed.server'
                  }
                ]
              }
            },
            signingOut: {
              exit: ['emitLogout'],
              invoke: {
                src: 'signout',
                id: 'signingOut',
                onDone: '#nhost.authentication.signedOut',
                onError: '#nhost.authentication.signedOut'
              }
            },
            signedIn: {
              tags: ['ready'],
              type: 'parallel',
              on: {
                SIGNOUT: '#nhost.authentication.signingOut'
              },
              states: {
                changeEmail: {
                  initial: 'idle',
                  invoke: {
                    id: 'changePasswordMachine',
                    src: 'changePasswordMachine'
                  },
                  on: {
                    CHANGE_EMAIL: {
                      actions: 'requestEmailChange'
                    },
                    CHANGE_EMAIL_LOADING: '.running',
                    CHANGE_EMAIL_INVALID: '.idle.failed.validation',
                    CHANGE_EMAIL_SUCCESS: '.idle.needsVerification',
                    CHANGE_EMAIL_ERROR: '.idle.failed.server'
                  },
                  states: {
                    idle: {
                      initial: 'noErrors',
                      states: {
                        noErrors: {},
                        success: {},
                        needsVerification: {},
                        failed: {
                          initial: 'server',
                          entry: 'saveEmailChangeError',
                          exit: 'resetEmailChangeError',
                          states: {
                            server: {},
                            validation: {}
                          }
                        }
                      }
                    },
                    running: {}
                  }
                },
                changePassword: {
                  initial: 'idle',
                  invoke: [
                    {
                      id: 'changeEmailMachine',
                      src: 'changeEmailMachine'
                    }
                  ],
                  on: {
                    CHANGE_PASSWORD: {
                      actions: 'requestPasswordChange'
                    },
                    CHANGE_PASSWORD_LOADING: '.running',
                    CHANGE_PASSWORD_INVALID: '.idle.failed.validation',
                    CHANGE_PASSWORD_SUCCESS: '.idle.success',
                    CHANGE_PASSWORD_ERROR: '.idle.failed.server'
                  },
                  states: {
                    idle: {
                      initial: 'noErrors',
                      states: {
                        noErrors: {},
                        success: {},
                        failed: {
                          initial: 'server',
                          entry: 'savePasswordChangeError',
                          exit: 'resetPasswordChangeError',
                          states: { server: {}, validation: {} }
                        }
                      }
                    },
                    running: {}
                  }
                }
              }
            }
          }
        }
      }
    },
    {
      actions: {
        saveSession: assign({
          // TODO type
          user: (_, e: any) => e.data?.session?.user,
          accessToken: (_, e) => e.data?.session?.accessToken,
          refreshToken: (_, e) => e.data?.session?.refreshToken,
          mfa: (_, e) => e.data?.mfa ?? false
        }),

        emitLogout: send('SESSION_LOAD', { to: 'tokenRefresher' }),
        forwardToRefresher: forwardTo('tokenRefresher'),
        emitTryToken: send((ctx) => ({ type: 'TRY_TOKEN', token: ctx.refreshToken }), {
          to: 'tokenRefresher'
        }),
        emitSession: send(
          // TODO type
          (_, { data: { session } }: any) => ({ type: 'SESSION_LOAD', data: session }),
          {
            to: 'tokenRefresher'
          }
        ),

        // * Authenticaiton errors
        saveAuthenticationError: assign({
          // TODO type
          errors: ({ errors }, { error }: any) => ({ ...errors, authentication: error })
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

        // * Change password
        requestPasswordChange: send(
          (ctx, { password }) => ({
            type: 'REQUEST_CHANGE',
            password,
            accessToken: ctx.accessToken
          }),
          {
            to: 'changePasswordMachine'
          }
        ),
        savePasswordChangeError: assign({
          // TODO type
          errors: ({ errors }, { error }: any) => ({ ...errors, newPassword: error })
        }),
        resetPasswordChangeError: assign({
          errors: ({ errors: { newPassword, ...errors } }) => errors
        }),

        // * Change email
        requestEmailChange: send(
          (ctx, { email }) => ({
            type: 'REQUEST_CHANGE',
            email,
            accessToken: ctx.accessToken
          }),
          {
            to: 'changeEmailMachine'
          }
        ),
        saveEmailChangeError: assign({
          // TODO type
          errors: ({ errors }, { error }: any) => ({ ...errors, newEmail: error })
        }),
        resetEmailChangeError: assign({
          errors: ({ errors: { newEmail, ...errors } }) => errors
        })
      },

      guards: {
        isSignedIn: (ctx) => !!ctx.user && !!ctx.refreshToken && !!ctx.accessToken,
        hasRefreshToken: (ctx) => !!ctx.refreshToken,

        // * Authentication errors
        // TODO type
        unverified: (ctx, { data: { error } }: any) =>
          error.status === 401 && error.message === 'Email is not verified',

        // * Event guards
        hasSession: (_, e) => !!e.data?.session,
        invalidEmail: (_, { email }) => !isValidEmail(email),
        invalidPassword: (_, { password }) => !isValidPassword(password)
      },

      services: {
        tokenRefresher: createTokenRefresherMachine({
          api,
          storageGetter,
          storageSetter,
          autoRefreshToken
        }),
        changePasswordMachine: createChangePasswordMachine(api),
        changeEmailMachine: createChangeEmailMachine(api),

        // TODO options
        signInPassword: (_, { email, password }) =>
          postRequest('/v1/auth/signin/email-password', {
            email,
            password
          }),
        signInPasswordlessEmail: (_, { email }) =>
          postRequest('/v1/auth/signin/passwordless/email', {
            email
          }),

        signout: (ctx, e) =>
          postRequest('/v1/auth/signout', {
            refreshToken: ctx.refreshToken,
            all: !!e.all
          }),

        //   TODO options
        registerUser: (_, { email, password }) =>
          postRequest('/v1/auth/signup/email-password', {
            email,
            password
          }),

        autoLogin: createAutoLoginMachine({ autoLogin })
      }
    }
  )
}
