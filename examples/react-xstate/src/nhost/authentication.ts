import { assign } from '@xstate/immer'
import { ActionFunctionMap, StatesConfig } from 'xstate'
import { NhostContext } from './context'
import { MIN_TOKEN_REFRESH_INTERVAL, TOKEN_REFRESH_MARGIN } from './constants'
import { userActions, userConfig, userGuards } from './user'

export const authenticationConfig: StatesConfig<NhostContext, any, any> = {
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
          ...userConfig
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
  }
}

export const authenticationActions: ActionFunctionMap<NhostContext, any, any> = {
  ...userActions,
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

  // * Authenticaiton errors
  saveAuthenticationError: assign((ctx, { data: { error } }) => {
    ctx.error = error
  }),
  resetAuthenticationError: assign((ctx) => {
    ctx.error = null
  })
}

export const authenticationGuards: Record<string, (ctx: NhostContext, e: any) => boolean> = {
  ...userGuards,

  isUserSet: (ctx) => !!ctx.user,
  // * Authentication errors
  unverified: (ctx) => ctx.error?.status === 401 && ctx.error.message === 'Email is not verified',
  existingUser: (ctx) => ctx.error?.status === 409,
  unauthorized: (ctx) => ctx.error?.status === 401,
  networkError: (ctx, e) => ctx.error?.status === 0
}
