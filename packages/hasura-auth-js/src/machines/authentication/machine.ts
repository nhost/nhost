import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import type {
  AuthenticationCredentialJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationCredentialJSON
} from '@simplewebauthn/typescript-types'
import { assign, createMachine, InterpreterFrom, send } from 'xstate'
import {
  NHOST_JWT_EXPIRES_AT_KEY,
  NHOST_REFRESH_TOKEN_ID_KEY,
  NHOST_REFRESH_TOKEN_KEY,
  REFRESH_TOKEN_MAX_ATTEMPTS,
  TOKEN_REFRESH_MARGIN_SECONDS
} from '../../constants'
import {
  CodifiedError,
  INVALID_EMAIL_ERROR,
  INVALID_MFA_TICKET_ERROR,
  INVALID_PASSWORD_ERROR,
  INVALID_PHONE_NUMBER_ERROR,
  NETWORK_ERROR_CODE,
  NO_MFA_TICKET_ERROR,
  VALIDATION_ERROR_CODE
} from '../../errors'
import { localStorageGetter, localStorageSetter } from '../../local-storage'
import {
  AuthErrorPayload,
  AuthOptions,
  DeanonymizeResponse,
  NhostSession,
  NhostSessionResponse,
  PasswordlessEmailResponse,
  PasswordlessSmsOtpResponse,
  PasswordlessSmsResponse,
  RefreshSessionResponse,
  SignInAnonymousResponse,
  SignInEmailOTPResponse,
  SignInMfaTotpResponse,
  SignInPATResponse,
  SignInResponse,
  SignOutResponse,
  SignUpResponse,
  VerifyEmailOTPResponse
} from '../../types'
import {
  getParameterByName,
  isValidEmail,
  isValidPassword,
  isValidPhoneNumber,
  isValidTicket,
  postFetch,
  removeParameterFromWindow,
  rewriteRedirectTo
} from '../../utils'
import { AuthContext, INITIAL_MACHINE_CONTEXT } from './context'
import { AuthEvents } from './events'

export interface AuthMachineOptions extends AuthOptions {
  backendUrl: string
  clientUrl: string
}

export type AuthMachine = ReturnType<typeof createAuthMachine>
export type AuthInterpreter = InterpreterFrom<AuthMachine>

type AuthServices = {
  signInPassword: { data: SignInResponse }
  passwordlessSms: { data: PasswordlessSmsResponse | DeanonymizeResponse }
  passwordlessSmsOtp: { data: PasswordlessSmsOtpResponse }
  signInEmailOTP: { data: SignInEmailOTPResponse }
  verifyEmailOTP: { data: VerifyEmailOTPResponse }
  passwordlessEmail: { data: PasswordlessEmailResponse | DeanonymizeResponse }
  signInAnonymous: { data: SignInAnonymousResponse }
  signInPAT: { data: SignInPATResponse }
  signInIdToken: { data: SignInResponse }
  signInMfaTotp: { data: SignInMfaTotpResponse }
  signInSecurityKeyEmail: { data: SignInResponse }
  signInSecurityKey: { data: SignInResponse }
  refreshToken: { data: NhostSessionResponse }
  signout: { data: SignOutResponse }
  signUpEmailPassword: { data: SignUpResponse }
  signUpSecurityKey: { data: SignUpResponse }
  importRefreshToken: { data: NhostSessionResponse }
}

export const createAuthMachine = ({
  backendUrl,
  clientUrl,
  broadcastKey,
  clientStorageType = 'web',
  clientStorage,
  refreshIntervalTime,
  autoRefreshToken = true,
  autoSignIn = true
}: AuthMachineOptions) => {
  const storageGetter = localStorageGetter(clientStorageType, clientStorage)
  const storageSetter = localStorageSetter(clientStorageType, clientStorage)
  const postRequest = async <T = any, D = any>(
    url: string,
    data?: D,
    token?: string | null,
    headers?: Record<string, string>
  ): Promise<T> => {
    const result = await postFetch<T>(`${backendUrl}${url}`, data, token, headers)

    return result.data
  }
  return createMachine(
    {
      schema: {
        context: {} as AuthContext,
        events: {} as AuthEvents,
        services: {} as AuthServices
      },
      tsTypes: {} as import('./machine.typegen').Typegen0,
      context: INITIAL_MACHINE_CONTEXT,
      predictableActionArguments: true,
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
              tags: ['loading'],
              always: { cond: 'isSignedIn', target: 'signedIn' },
              invoke: {
                id: 'importRefreshToken',
                src: 'importRefreshToken',
                onDone: [
                  {
                    cond: 'hasSession',
                    actions: ['saveSession', 'reportTokenChanged'],
                    target: 'signedIn'
                  },
                  {
                    target: 'signedOut'
                  }
                ],
                onError: [
                  {
                    cond: 'shouldRetryImportToken',
                    actions: 'incrementTokenImportAttempts',
                    target: 'retryTokenImport'
                  },
                  { actions: ['saveAuthenticationError'], target: 'signedOut' }
                ]
              }
            },
            retryTokenImport: {
              tags: ['loading'],
              after: {
                RETRY_IMPORT_TOKEN_DELAY: 'starting'
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
                failed: {},
                signingOut: {
                  entry: ['clearContextExceptTokens'],
                  exit: ['destroyAccessToken', 'destroyRefreshToken', 'reportTokenChanged'],
                  invoke: {
                    src: 'signout',
                    id: 'signingOut',
                    onDone: {
                      target: 'success'
                    },
                    onError: {
                      target: 'failed',
                      actions: ['saveAuthenticationError']
                    }
                  }
                }
              },
              on: {
                SIGNIN_PASSWORD: 'authenticating.password',
                SIGNIN_ANONYMOUS: 'authenticating.anonymous',
                SIGNIN_SECURITY_KEY_EMAIL: 'authenticating.securityKeyEmail',
                SIGNIN_SECURITY_KEY: 'authenticating.securityKey',
                SIGNIN_MFA_TOTP: 'authenticating.mfa.totp',
                SIGNIN_PAT: 'authenticating.pat',
                SIGNIN_ID_TOKEN: 'authenticating.idToken'
              }
            },
            authenticating: {
              entry: 'resetErrors',
              states: {
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
                        target: [
                          '#nhost.authentication.signedOut',
                          '#nhost.registration.incomplete.needsEmailVerification'
                        ]
                      },
                      {
                        actions: 'saveAuthenticationError',
                        target: '#nhost.authentication.signedOut.failed'
                      }
                    ]
                  }
                },
                pat: {
                  invoke: {
                    src: 'signInPAT',
                    id: 'authenticateWithPAT',
                    onDone: {
                      actions: ['savePATSession', 'reportTokenChanged'],
                      target: '#nhost.authentication.signedIn'
                    },
                    onError: {
                      actions: 'saveAuthenticationError',
                      target: '#nhost.authentication.signedOut.failed'
                    }
                  }
                },
                idToken: {
                  invoke: {
                    src: 'signInIdToken',
                    id: 'authenticateWithIdToken',
                    onDone: {
                      actions: ['saveSession', 'reportTokenChanged'],
                      target: '#nhost.authentication.signedIn'
                    },
                    onError: {
                      actions: 'saveAuthenticationError',
                      target: '#nhost.authentication.signedOut.failed'
                    }
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
                      target: '#nhost.authentication.signedOut.failed'
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
                          target: '#nhost.authentication.signedOut.failed'
                        }
                      }
                    }
                  }
                },
                securityKeyEmail: {
                  invoke: {
                    src: 'signInSecurityKeyEmail',
                    id: 'authenticateUserWithSecurityKey',
                    onDone: {
                      actions: ['saveSession', 'reportTokenChanged'],
                      target: '#nhost.authentication.signedIn'
                    },
                    onError: [
                      {
                        cond: 'unverified',
                        target: [
                          '#nhost.authentication.signedOut',
                          '#nhost.registration.incomplete.needsEmailVerification'
                        ]
                      },
                      {
                        actions: 'saveAuthenticationError',
                        target: '#nhost.authentication.signedOut.failed'
                      }
                    ]
                  }
                },
                securityKey: {
                  invoke: {
                    src: 'signInSecurityKey',
                    id: 'authenticateUserWithSecurityKey',
                    onDone: {
                      actions: ['saveSession', 'reportTokenChanged'],
                      target: '#nhost.authentication.signedIn'
                    },
                    onError: [
                      {
                        cond: 'unverified',
                        target: [
                          '#nhost.authentication.signedOut',
                          '#nhost.registration.incomplete.needsEmailVerification'
                        ]
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
            signedIn: {
              type: 'parallel',
              entry: ['reportSignedIn', 'cleanUrl', 'broadcastToken', 'resetErrors'],
              on: {
                SIGNOUT: 'signedOut.signingOut'
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
                        { cond: 'isRefreshTokenPAT', target: 'disabled' },
                        { cond: 'hasRefreshToken', target: 'running' }
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
                              {
                                cond: 'isUnauthorizedError',
                                target: '#nhost.authentication.signedOut'
                              },
                              { actions: 'saveRefreshAttempt', target: 'pending' }
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
                  { cond: 'isSignedIn', target: 'idle.error' },
                  {
                    actions: 'saveAuthenticationError',
                    target: ['#nhost.authentication.signedOut.failed', 'idle.error']
                  }
                ]
              }
            }
          }
        },
        registration: {
          initial: 'incomplete',
          on: {
            SIGNED_IN: [{ cond: 'isAnonymous', target: '.incomplete' }, '.complete']
          },
          states: {
            incomplete: {
              on: {
                SIGNUP_EMAIL_PASSWORD: 'emailPassword',
                SIGNUP_SECURITY_KEY: 'securityKey',
                PASSWORDLESS_EMAIL: 'passwordlessEmail',
                PASSWORDLESS_SMS: 'passwordlessSms',
                PASSWORDLESS_SMS_OTP: 'passwordlessSmsOtp',
                SIGNIN_EMAIL_OTP: 'signInEmailOTP',
                VERIFY_EMAIL_OTP: 'verifyEmailOTP'
              },
              initial: 'noErrors',
              states: {
                noErrors: {},
                needsEmailVerification: {},
                needsOtp: {},
                failed: {}
              }
            },
            emailPassword: {
              entry: ['resetErrors'],
              invoke: {
                src: 'signUpEmailPassword',
                id: 'signUpEmailPassword',
                onDone: [
                  {
                    cond: 'hasSession',
                    actions: ['saveSession', 'reportTokenChanged'],
                    target: '#nhost.authentication.signedIn'
                  },
                  {
                    actions: 'clearContext',
                    target: ['#nhost.authentication.signedOut', 'incomplete.needsEmailVerification']
                  }
                ],
                onError: [
                  {
                    cond: 'unverified',
                    target: 'incomplete.needsEmailVerification'
                  },
                  {
                    actions: 'saveRegistrationError',
                    target: 'incomplete.failed'
                  }
                ]
              }
            },
            securityKey: {
              entry: ['resetErrors'],
              invoke: {
                src: 'signUpSecurityKey',
                id: 'signUpSecurityKey',
                onDone: [
                  {
                    cond: 'hasSession',
                    actions: ['saveSession', 'reportTokenChanged'],
                    target: '#nhost.authentication.signedIn'
                  },
                  {
                    actions: 'clearContext',
                    target: ['#nhost.authentication.signedOut', 'incomplete.needsEmailVerification']
                  }
                ],
                onError: [
                  {
                    cond: 'unverified',
                    target: 'incomplete.needsEmailVerification'
                  },
                  {
                    actions: 'saveRegistrationError',
                    target: 'incomplete.failed'
                  }
                ]
              }
            },
            passwordlessEmail: {
              entry: ['resetErrors'],
              invoke: {
                src: 'passwordlessEmail',
                id: 'passwordlessEmail',
                onDone: {
                  actions: 'clearContext',
                  target: ['#nhost.authentication.signedOut', 'incomplete.needsEmailVerification']
                },
                onError: {
                  actions: 'saveRegistrationError',
                  target: 'incomplete.failed'
                }
              }
            },
            passwordlessSms: {
              entry: ['resetErrors'],
              invoke: {
                src: 'passwordlessSms',
                id: 'passwordlessSms',
                onDone: {
                  actions: 'clearContext',
                  target: ['#nhost.authentication.signedOut', 'incomplete.needsOtp']
                },
                onError: {
                  actions: 'saveRegistrationError',
                  target: 'incomplete.failed'
                }
              }
            },
            passwordlessSmsOtp: {
              entry: ['resetErrors'],
              invoke: {
                src: 'passwordlessSmsOtp',
                id: 'passwordlessSmsOtp',
                onDone: {
                  actions: ['saveSession', 'reportTokenChanged'],
                  target: '#nhost.authentication.signedIn'
                },
                onError: {
                  actions: 'saveRegistrationError',
                  target: 'incomplete.failed'
                }
              }
            },
            signInEmailOTP: {
              entry: ['resetErrors'],
              invoke: {
                src: 'signInEmailOTP',
                id: 'signInEmailOTP',
                onDone: {
                  actions: 'clearContext',
                  target: ['#nhost.authentication.signedOut', 'incomplete.needsOtp']
                },
                onError: {
                  actions: 'saveRegistrationError',
                  target: 'incomplete.failed'
                }
              }
            },
            verifyEmailOTP: {
              entry: ['resetErrors'],
              invoke: {
                src: 'verifyEmailOTP',
                id: 'verifyEmailOTP',
                onDone: {
                  actions: ['saveSession', 'reportTokenChanged'],
                  target: '#nhost.authentication.signedIn'
                },
                onError: {
                  actions: 'saveRegistrationError',
                  target: 'incomplete.failed'
                }
              }
            },
            complete: {
              on: {
                SIGNED_OUT: 'incomplete'
              }
            }
          }
        }
      }
    },
    {
      actions: {
        reportSignedIn: send('SIGNED_IN'),
        reportSignedOut: send('SIGNED_OUT'),
        reportTokenChanged: send('TOKEN_CHANGED'),
        incrementTokenImportAttempts: assign({
          importTokenAttempts: ({ importTokenAttempts }) => importTokenAttempts + 1
        }),
        clearContext: assign(() => {
          storageSetter(NHOST_JWT_EXPIRES_AT_KEY, null)
          storageSetter(NHOST_REFRESH_TOKEN_KEY, null)
          storageSetter(NHOST_REFRESH_TOKEN_ID_KEY, null)
          return {
            ...INITIAL_MACHINE_CONTEXT
          }
        }),
        clearContextExceptTokens: assign(({ accessToken, refreshToken }) => {
          return {
            ...INITIAL_MACHINE_CONTEXT,
            accessToken: accessToken,
            refreshToken: refreshToken
          }
        }),

        // * Save session in the context, and persist the refresh token and the jwt expiration outside of the machine
        saveSession: assign({
          user: (_, { data }) => data?.session?.user || null,
          accessToken: (_, { data }) => {
            if (data.session) {
              const { accessTokenExpiresIn, accessToken } = data.session
              const nextRefresh = new Date(Date.now() + accessTokenExpiresIn * 1_000)
              storageSetter(NHOST_JWT_EXPIRES_AT_KEY, nextRefresh.toISOString())
              return {
                value: accessToken,
                expiresAt: nextRefresh,
                expiresInSeconds: accessTokenExpiresIn
              }
            }
            storageSetter(NHOST_JWT_EXPIRES_AT_KEY, null)
            return {
              value: null,
              expiresAt: null,
              expiresInSeconds: null
            }
          },
          refreshToken: (_, { data }) => {
            const refreshToken = data.session?.refreshToken || null
            const refreshTokenId = data.session?.refreshTokenId || null

            if (refreshToken) {
              storageSetter(NHOST_REFRESH_TOKEN_KEY, refreshToken)
            }

            if (refreshTokenId) {
              storageSetter(NHOST_REFRESH_TOKEN_ID_KEY, refreshTokenId)
            }

            return { value: refreshToken }
          }
        }),

        savePATSession: assign({
          user: (_, { data }) => data?.session?.user || null,
          accessToken: (_, { data }) => {
            if (data.session) {
              const { accessTokenExpiresIn, accessToken } = data.session
              const nextRefresh = new Date(Date.now() + accessTokenExpiresIn * 1_000)
              storageSetter(NHOST_JWT_EXPIRES_AT_KEY, nextRefresh.toISOString())
              return {
                value: accessToken,
                expiresAt: nextRefresh,
                expiresInSeconds: accessTokenExpiresIn
              }
            }
            storageSetter(NHOST_JWT_EXPIRES_AT_KEY, null)
            return {
              value: null,
              expiresAt: null,
              expiresInSeconds: null
            }
          },
          refreshToken: (_, { data }) => {
            const refreshToken = data.session?.refreshToken || null
            const refreshTokenId = data.session?.refreshTokenId || null

            if (refreshToken) {
              storageSetter(NHOST_REFRESH_TOKEN_KEY, refreshToken)
            }

            if (refreshTokenId) {
              storageSetter(NHOST_REFRESH_TOKEN_ID_KEY, refreshTokenId)
            }

            return { value: refreshToken, isPAT: true }
          }
        }),

        saveMfaTicket: assign({
          mfa: (_, e) => e.data?.mfa
        }),

        resetTimer: assign({
          refreshTimer: (_) => ({
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

        // * Authentication errors
        saveAuthenticationError: assign({
          // * Untyped action payload. See https://github.com/statelyai/xstate/issues/3037
          errors: ({ errors }, { data: { error } }: any) => ({
            ...errors,
            authentication: error
          })
        }),
        resetErrors: assign({
          errors: (_) => ({}),
          importTokenAttempts: (_) => 0
        }),
        saveRegistrationError: assign({
          // * Untyped action payload. See https://github.com/statelyai/xstate/issues/3037
          errors: ({ errors }, { data: { error } }: any) => ({ ...errors, registration: error })
        }),
        destroyRefreshToken: assign({
          refreshToken: (_) => {
            storageSetter(NHOST_REFRESH_TOKEN_KEY, null)
            storageSetter(NHOST_REFRESH_TOKEN_ID_KEY, null)
            return { value: null }
          }
        }),

        destroyAccessToken: assign({
          accessToken: (_) => {
            storageSetter(NHOST_JWT_EXPIRES_AT_KEY, null)
            return {
              value: null,
              expiresAt: null,
              expiresInSeconds: null
            }
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
          if (autoSignIn && broadcastKey) {
            try {
              const channel = new BroadcastChannel(broadcastKey)
              // ? broadcat session instead of token ?
              channel.postMessage({
                type: 'broadcast_token',
                payload: {
                  token: context.refreshToken.value
                }
              })
            } catch (error) {
              // * BroadcastChannel is not available e.g. react-native
            }
          }
        }
      },

      guards: {
        isAnonymous: (ctx, e) => !!ctx.user?.isAnonymous,
        isSignedIn: (ctx) => !!ctx.user && !!ctx.accessToken.value,
        noToken: (ctx) => !ctx.refreshToken.value,
        isRefreshTokenPAT: (ctx) => !!ctx.refreshToken?.isPAT,
        hasRefreshToken: (ctx) => !!ctx.refreshToken.value,
        isAutoRefreshDisabled: () => !autoRefreshToken,
        refreshTimerShouldRefresh: (ctx) => {
          const { expiresAt } = ctx.accessToken

          if (!expiresAt) {
            return false
          }

          if (ctx.refreshTimer.lastAttempt) {
            // * If the refresh timer reached the maximum number of attempts, we should not try again
            if (ctx.refreshTimer.attempts > REFRESH_TOKEN_MAX_ATTEMPTS) {
              return false
            }
            const elapsed = Date.now() - ctx.refreshTimer.lastAttempt.getTime()
            // * Exponential backoff
            return elapsed > Math.pow(2, ctx.refreshTimer.attempts - 1) * 5_000
          }

          // This happens when either the computer goes to sleep or when Chrome descides to suspend the tab
          if (expiresAt.getTime() < Date.now()) {
            return true
          }

          if (refreshIntervalTime) {
            // * If a refreshIntervalTime has been passed on as an option, it will notify
            // * the token should be refershed when this interval is overdue
            const elapsed = Date.now() - ctx.refreshTimer.startedAt!.getTime()
            if (elapsed > refreshIntervalTime * 1_000) {
              return true
            }
          }
          // * In any case, it's time to refresh when there's less than
          // * TOKEN_REFRESH_MARGIN_SECONDS seconds before the JWT exprires
          const accessTokenExpirationTime = ctx.accessToken.expiresInSeconds

          if (!accessTokenExpirationTime) {
            return false
          }

          const expiresInMilliseconds = expiresAt.getTime() - Date.now()

          // If the token expires in less time than the margin, we should use
          // a margin based on the token expiration time to avoid refreshing
          // the token infinitely
          const remainingMilliseconds =
            expiresInMilliseconds -
            1_000 * Math.min(TOKEN_REFRESH_MARGIN_SECONDS, accessTokenExpirationTime * 0.5)

          return remainingMilliseconds <= 0
        },
        // * Untyped action payload. See https://github.com/statelyai/xstate/issues/3037
        /** Shoud retry to import the token on network error or any internal server error.
         * Don't retry more than REFRESH_TOKEN_MAX_ATTEMPTS times.
         */
        shouldRetryImportToken: (ctx, e: any) =>
          ctx.importTokenAttempts < REFRESH_TOKEN_MAX_ATTEMPTS &&
          (e.data.error.status === NETWORK_ERROR_CODE || e.data.error.status >= 500),
        // * Authentication errors
        // * Untyped action payload. See https://github.com/statelyai/xstate/issues/3037
        unverified: (_, { data: { error } }: any) =>
          error.status === 401 &&
          // * legacy: don't use the message contents to determine if the email is unverified, but the error type (error.error)
          (error.message === 'Email is not verified' || error.error === 'unverified-user'),

        // * Event guards
        hasSession: (_, e) => !!e.data?.session,
        hasMfaTicket: (_, e) => !!e.data?.mfa,
        isUnauthorizedError: (_, { data: { error } }: any) => error.status === 401
      },

      services: {
        signInPassword: (_, { email, password }) => {
          if (!isValidEmail(email)) {
            return Promise.reject({ error: INVALID_EMAIL_ERROR })
          }
          if (!isValidPassword(password)) {
            return Promise.reject({ error: INVALID_PASSWORD_ERROR })
          }
          return postRequest<SignInResponse>('/signin/email-password', {
            email,
            password
          })
        },
        signInPAT: (_context, { pat }) => {
          return postRequest<SignInPATResponse>('/signin/pat', {
            personalAccessToken: pat
          })
        },
        signInIdToken: (_context, { provider, idToken, nonce }) => {
          return postRequest<SignInResponse>('/signin/idtoken', {
            provider,
            idToken,
            ...(nonce && { nonce })
          })
        },
        passwordlessSms: (context, { phoneNumber, options }) => {
          if (!isValidPhoneNumber(phoneNumber)) {
            return Promise.reject({ error: INVALID_PHONE_NUMBER_ERROR })
          }
          if (context.user?.isAnonymous) {
            // TODO implement in hasura-auth
            // * See https://github.com/nhost/hasura-auth/blob/9c6d0f4ded4fc8fd1b8031926c02796c74a7eada/src/routes/user/deanonymize.ts
            console.warn(
              'Deanonymisation from a phone number is not yet implemented in hasura-auth'
            )
            return postRequest(
              '/user/deanonymize',
              {
                signInMethod: 'passwordless',
                connection: 'sms',
                phoneNumber,
                options: rewriteRedirectTo(clientUrl, options)
              },
              context.accessToken.value
            )
          } else {
            return postRequest('/signin/passwordless/sms', {
              phoneNumber,
              options: rewriteRedirectTo(clientUrl, options)
            })
          }
        },
        passwordlessSmsOtp: (_, { phoneNumber, otp }) => {
          if (!isValidPhoneNumber(phoneNumber)) {
            return Promise.reject({ error: INVALID_PHONE_NUMBER_ERROR })
          }
          return postRequest('/signin/passwordless/sms/otp', {
            phoneNumber,
            otp
          })
        },
        signInEmailOTP: (_, { email, options }) => {
          if (!isValidEmail(email)) {
            return Promise.reject({ error: INVALID_EMAIL_ERROR })
          }

          return postRequest('/signin/otp/email', {
            email,
            options: rewriteRedirectTo(clientUrl, options)
          })
        },
        verifyEmailOTP: (_, { email, otp }) => {
          if (!isValidEmail(email)) {
            return Promise.reject({ error: INVALID_EMAIL_ERROR })
          }

          return postRequest('/signin/otp/email/verify', {
            email,
            otp
          })
        },
        passwordlessEmail: (context, { email, options }) => {
          if (!isValidEmail(email)) {
            return Promise.reject({ error: INVALID_EMAIL_ERROR })
          }
          if (context.user?.isAnonymous) {
            return postRequest(
              '/user/deanonymize',
              {
                signInMethod: 'passwordless',
                connection: 'email',
                email,
                options: rewriteRedirectTo(clientUrl, options)
              },
              context.accessToken.value
            )
          } else {
            return postRequest('/signin/passwordless/email', {
              email,
              options: rewriteRedirectTo(clientUrl, options)
            })
          }
        },
        signInAnonymous: (_) => postRequest('/signin/anonymous'),
        signInMfaTotp: (context, data) => {
          const ticket: string | undefined = data.ticket || context.mfa?.ticket
          if (!ticket) {
            return Promise.reject({ error: NO_MFA_TICKET_ERROR })
          }
          if (!isValidTicket(ticket)) {
            return Promise.reject({ error: INVALID_MFA_TICKET_ERROR })
          }

          return postRequest('/signin/mfa/totp', {
            ticket,
            otp: data.otp
          })
        },
        signInSecurityKeyEmail: async (_, { email }) => {
          if (!isValidEmail(email)) {
            throw new CodifiedError(INVALID_EMAIL_ERROR)
          }
          const options = await postRequest<PublicKeyCredentialRequestOptionsJSON>(
            '/signin/webauthn',
            { email }
          )
          let credential: AuthenticationCredentialJSON
          try {
            credential = await startAuthentication(options)
          } catch (e) {
            throw new CodifiedError(e as Error)
          }
          return postRequest<SignInResponse>('/signin/webauthn/verify', { email, credential })
        },
        refreshToken: async (ctx, event) => {
          const refreshToken = event.type === 'TRY_TOKEN' ? event.token : ctx.refreshToken.value
          const session: NhostSession = await postRequest<RefreshSessionResponse>('/token', {
            refreshToken
          })
          return { session, error: null }
        },
        signInSecurityKey: async (): Promise<SignInResponse> => {
          try {
            const options: PublicKeyCredentialRequestOptionsJSON = await postRequest(
              '/signin/webauthn',
              {}
            )

            let credential: AuthenticationCredentialJSON
            try {
              credential = await startAuthentication(options)
            } catch (e) {
              throw new CodifiedError(e as Error)
            }
            return postRequest<SignInResponse>('/signin/webauthn/verify', { credential })
          } catch (error) {
            throw new CodifiedError(error as Error)
          }
        },
        signout: async (ctx, e) => {
          const signOutResponse = await postRequest(
            '/signout',
            {
              refreshToken: ctx.refreshToken.value,
              all: !!e.all
            },
            !!e.all ? ctx.accessToken.value : undefined
          )

          if (broadcastKey) {
            try {
              const channel = new BroadcastChannel(broadcastKey)
              // ? broadcast the signout event to other tabs to remove the accessToken
              channel.postMessage({ type: 'signout' })
            } catch (error) {
              // * BroadcastChannel is not available e.g. react-native
            }
          }

          return signOutResponse
        },
        signUpEmailPassword: async (context, { email, password, options, requestOptions }) => {
          if (!isValidEmail(email)) {
            return Promise.reject<SignUpResponse>({ error: INVALID_EMAIL_ERROR })
          }
          if (!isValidPassword(password)) {
            return Promise.reject<SignUpResponse>({ error: INVALID_PASSWORD_ERROR })
          }

          if (context.user?.isAnonymous) {
            return postRequest<SignUpResponse>(
              '/user/deanonymize',
              {
                signInMethod: 'email-password',
                email,
                password,
                options: rewriteRedirectTo(clientUrl, options)
              },
              context.accessToken.value,
              requestOptions?.headers
            )
          } else {
            return postRequest<SignUpResponse>(
              '/signup/email-password',
              {
                email,
                password,
                options: rewriteRedirectTo(clientUrl, options)
              },
              null,
              requestOptions?.headers
            )
          }
        },
        signUpSecurityKey: async (_, { email, options }) => {
          if (!isValidEmail(email)) {
            return Promise.reject<SignUpResponse>({ error: INVALID_EMAIL_ERROR })
          }
          // TODO anonymous users
          const nickname = options?.nickname
          /*
           * The `/signup/webauthn` endpoint accepts any option from SignUpOptions,
           * We therefore remove the nickname from the options object before sending it to the server,
           * as options if of type `SignUpSecurityKeyOptions`, which extends `SignUpOptions` with the optional `nickname` property.
           */
          if (nickname) delete options.nickname
          const webAuthnOptions = await postRequest<PublicKeyCredentialCreationOptionsJSON>(
            '/signup/webauthn',
            { email, options }
          )
          let credential: RegistrationCredentialJSON
          try {
            credential = await startRegistration(webAuthnOptions)
          } catch (e) {
            throw new CodifiedError(e as Error)
          }
          return postRequest<SignUpResponse>('/signup/webauthn/verify', {
            credential,
            options: {
              redirectTo: options?.redirectTo,
              nickname
            }
          })
        },
        importRefreshToken: async (ctx) => {
          if (
            ctx.user &&
            ctx.refreshToken.value &&
            ctx.accessToken.value &&
            ctx.accessToken.expiresAt
          ) {
            // * Do not import refresh token if the session already exists (loaded through initial state)
            // TODO this should eventually be handled upstream in the state machine
            return {
              session: {
                accessToken: ctx.accessToken.value,
                accessTokenExpiresIn: ctx.accessToken.expiresAt.getTime() - Date.now(),
                refreshToken: ctx.refreshToken.value,
                user: ctx.user
              },
              error: null
            }
          }
          let error: AuthErrorPayload | null = null
          if (autoSignIn) {
            const urlToken = getParameterByName('refreshToken') || null
            if (urlToken) {
              try {
                const session = await postRequest<NhostSession>('/token', {
                  refreshToken: urlToken
                })
                return { session, error: null }
              } catch (exception) {
                error = (exception as { error: AuthErrorPayload }).error
              }
            } else {
              const error = getParameterByName('error')
              const errorDescription = getParameterByName('errorDescription')

              if (error) {
                if (errorDescription !== 'social user already exists') {
                  return Promise.reject<NhostSessionResponse>({
                    session: null,
                    error: {
                      status: VALIDATION_ERROR_CODE,
                      error,
                      message: errorDescription || error
                    }
                  })
                }
              }
            }
          }
          const storageToken = await storageGetter(NHOST_REFRESH_TOKEN_KEY)
          if (storageToken) {
            try {
              const session = await postRequest<NhostSession>('/token', {
                refreshToken: storageToken
              })
              return { session, error: null }
            } catch (exception) {
              error = (exception as { error: AuthErrorPayload }).error
            }
          }
          if (error) {
            return Promise.reject<NhostSessionResponse>({ error, session: null })
          }
          return { error: null, session: null }
        }
      },
      delays: {
        RETRY_IMPORT_TOKEN_DELAY: ({ importTokenAttempts }) => {
          // * Exponential backoff
          return Math.pow(2, importTokenAttempts - 1) * 5_000
        }
      }
    }
  )
}
