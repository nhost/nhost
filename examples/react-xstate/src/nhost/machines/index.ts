import { AxiosRequestConfig, AxiosResponse } from 'axios'
import { assign, createMachine, forwardTo, send } from 'xstate'

import { StorageGetter, StorageSetter } from '../storage'
import { nhostApiClient } from '../hasura-auth'
import { isValidEmail, isValidPassword } from '../validators'

import { createChangePasswordMachine } from './change-password'
import { createChangeEmailMachine } from './change-email'
import { INITIAL_CONTEXT, NhostContext } from './context'
import { createTokenRefresherMachine } from './token-refresher'
import { NhostEvents } from './events'

export type NhostInitOptions = {
  backendUrl: string
  storageGetter?: StorageGetter
  storageSetter?: StorageSetter
}

export type NhostMachine = ReturnType<typeof createNhostMachine>

export const createNhostMachine = ({
  backendUrl,
  storageSetter,
  storageGetter
}: Required<NhostInitOptions>) => {
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
      context: INITIAL_CONTEXT,
      id: 'nhost',
      type: 'parallel',
      on: {
        LOAD_TOKEN: {
          actions: 'forwardToRefresher'
        }
      },

      states: {
        authentication: {
          initial: 'signedOut',
          invoke: {
            id: 'tokenRefresher',
            src: 'tokenRefresher'
          },
          on: {
            SESSION_UPDATE: [
              {
                cond: 'hasUser',
                actions: 'saveSession'
              },
              '.signedOut'
            ]
          },
          states: {
            signedOut: {
              tags: ['ready'],
              initial: 'noErrors',
              entry: 'saveSession',
              states: {
                noErrors: {},
                invalid: {
                  states: { password: {}, email: {} }
                },
                needsVerification: {},
                failed: {
                  exit: 'resetAuthenticationError'
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
                    target: '.invalid.email'
                  },
                  {
                    cond: 'invalidPassword',
                    target: '.invalid.password'
                  },
                  {
                    target: '#nhost.authentication.authenticating.password'
                  }
                ],
                SIGNIN_PASSWORDLESS_EMAIL: [
                  {
                    cond: 'invalidEmail',
                    target: '.invalid.email'
                  },
                  '#nhost.authentication.authenticating.passwordlessEmail'
                ],
                REGISTER: [
                  {
                    cond: 'invalidEmail',
                    target: '.invalid.email'
                  },
                  {
                    cond: 'invalidPassword',
                    target: '.invalid.password'
                  },
                  {
                    target: '#nhost.authentication.registering'
                  }
                ]
              }
            },
            authenticating: {
              states: {
                passwordlessEmail: {
                  invoke: {
                    src: 'signInPasswordlessEmail',
                    id: 'authenticatePasswordlessEmail',
                    onDone: {
                      target: '#nhost.authentication.signedOut.needsVerification'
                    },
                    onError: {
                      actions: 'saveAuthenticationError',
                      target: '#nhost.authentication.signedOut.failed'
                    }
                  }
                },
                password: {
                  invoke: {
                    src: 'signInPassword',
                    id: 'authenticateUserWithPassword',
                    onDone: {
                      actions: ['saveSession', 'emitToken'],
                      target: '#nhost.authentication.signedIn'
                    },
                    onError: [
                      {
                        cond: 'unverified',
                        target: '#nhost.authentication.signedOut.needsVerification'
                      },
                      {
                        actions: 'saveAuthenticationError',
                        target: '#nhost.authentication.signedOut.failed'
                      }
                    ]
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
                    actions: 'saveSession',
                    cond: 'hasUser',
                    target: '#nhost.authentication.signedIn'
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
                    actions: 'saveAuthenticationError',
                    target: '#nhost.authentication.signedOut.failed'
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
                SIGNOUT: {
                  target: '#nhost.authentication.signingOut'
                }
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
                    CHANGE_EMAIL_INVALID: '.idle.invalid',
                    CHANGE_EMAIL_SUCCESS: '.idle.needsVerification',
                    CHANGE_EMAIL_ERROR: {
                      target: '.idle.failed',
                      actions: 'saveEmailChangeError'
                    }
                  },
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
                    CHANGE_PASSWORD_INVALID: '.idle.invalid',
                    CHANGE_PASSWORD_SUCCESS: '.idle.success',
                    CHANGE_PASSWORD_ERROR: {
                      target: '.idle.failed',
                      actions: 'savePasswordChangeError'
                    }
                  },
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
          user: (_, e) => e.data?.session?.user,
          accessToken: (_, e) => e.data?.session?.accessToken,
          refreshToken: (_, e) => e.data?.session?.refreshToken,
          mfa: (_, e) => e.data?.mfa ?? false
        }),

        emitLogout: send('LOAD_TOKEN', { to: 'tokenRefresher' }),
        forwardToRefresher: forwardTo('tokenRefresher'),
        emitToken: send(
          // TODO type
          (_, { data: { session } }: any) => ({ type: 'LOAD_TOKEN', data: session }),
          {
            to: 'tokenRefresher'
          }
        ),

        // * Authenticaiton errors
        saveAuthenticationError: assign({
          // TODO type
          errors: ({ errors }, { data: { error } }: any) => ({ ...errors, authentication: error })
        }),
        resetAuthenticationError: assign({
          errors: ({ errors: { authentication, ...errors } }) => errors
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
          errors: ({ errors }, { error }) => ({ ...errors, newPassword: error })
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
          errors: ({ errors }, { error }) => ({ ...errors, newEmail: error })
        }),
        resetEmailChangeError: assign({
          errors: ({ errors: { newEmail, ...errors } }) => errors
        })
      },

      guards: {
        isUserSet: (ctx) => !!ctx.user,
        // * Authentication errors
        // TODO type
        unverified: (ctx, { data: { error } }: any) =>
          error.status === 401 && error.message === 'Email is not verified',

        // * Event guards
        hasUser: (_, e) => !!e.data?.session,
        invalidEmail: (_, { email }) => !isValidEmail(email),
        invalidPassword: (_, { password }) => !isValidPassword(password)
      },

      services: {
        tokenRefresher: createTokenRefresherMachine(api, storageGetter, storageSetter),
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
          })
      }
    }
  )
}
