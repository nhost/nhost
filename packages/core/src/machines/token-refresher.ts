import axios, { AxiosInstance } from 'axios'
import { assign, createMachine, sendParent } from 'xstate'

import {
  MIN_TOKEN_REFRESH_INTERVAL,
  NHOST_REFRESH_TOKEN_KEY,
  REFRESH_TOKEN_RETRY_INTERVAL,
  REFRESH_TOKEN_RETRY_MAX_ATTEMPTS,
  TOKEN_REFRESH_MARGIN
} from '../constants'
import { NETWORK_ERROR_CODE } from '../errors'
import { StorageGetter, StorageSetter } from '../storage'

type TokenRefresherContext = {
  token: string | null
  elapsed: number
  attempts: number
  expiration: number
  session: any
}
type TokenRefresherEvents =
  | { type: 'SESSION_LOAD'; data: any } // TODO types
  | { type: 'SIGNOUT'; all?: boolean }
  | { type: 'TRY_TOKEN'; token: string }

const expiration = (expiresIn: number) =>
  Math.max(expiresIn - TOKEN_REFRESH_MARGIN, MIN_TOKEN_REFRESH_INTERVAL)

export const createTokenRefresherMachine = ({
  api,
  storageGetter,
  storageSetter,
  ssr
}: {
  api: AxiosInstance
  storageGetter: StorageGetter
  storageSetter: StorageSetter
  ssr: boolean
}) =>
  createMachine(
    {
      schema: {
        context: {} as TokenRefresherContext,
        events: {} as TokenRefresherEvents
      },
      tsTypes: {} as import('./token-refresher.typegen').Typegen0,
      id: 'token',
      context: {
        token: storageGetter(NHOST_REFRESH_TOKEN_KEY, { ssr }), // TODO get token from cookie when SSR on the SERVER side
        elapsed: 0,
        attempts: 0,
        expiration: 0, // TODO get expiration from cookie when SSR on the CLIENT side
        session: null
      },
      on: {
        SESSION_LOAD: {
          actions: ['save', 'persist'],
          target: 'timer.idle'
        }
      },
      type: 'parallel',
      states: {
        refesher: {
          initial: 'idle',
          on: {
            TRY_TOKEN: '.running'
          },
          states: {
            idle: {
              initial: 'noError',
              states: { noError: {}, error: {} }
            },
            running: {
              invoke: {
                src: 'refreshToken',
                id: 'refreshToken',
                onDone: {
                  actions: ['save', 'resetTimer', 'persist', 'emit'],
                  target: 'idle'
                },
                onError: {
                  actions: ['sendError'],
                  target: 'idle.error'
                }
              }
            }
          }
        },
        timer: {
          id: 'timer',
          initial: 'idle',
          states: {
            stopped: {
              always: {
                cond: 'noToken',
                target: 'idle'
              }
            },
            idle: {
              always: {
                cond: 'token',
                target: 'running.refreshing'
              }
            },
            running: {
              initial: 'pending',
              states: {
                pending: {
                  after: {
                    '1000': {
                      actions: 'tick',
                      target: 'pending'
                    }
                  },
                  always: {
                    cond: 'shouldRefresh',
                    target: 'refreshing'
                  },
                  on: {
                    //   TODO
                    SIGNOUT: {
                      actions: ['resetTimer', 'resetToken'],
                      target: '#token.timer.stopped'
                    }
                  }
                },

                refreshing: {
                  invoke: {
                    src: 'refreshToken',
                    id: 'refreshToken',
                    onDone: {
                      actions: ['save', 'resetTimer', 'persist', 'emit'],
                      target: 'pending'
                    },
                    onError: [
                      {
                        actions: 'retry',
                        cond: 'canRetry',
                        target: 'pending'
                      },
                      {
                        actions: ['sendError', 'resetTimer', 'resetToken'],
                        target: '#token.timer.stopped'
                      }
                    ]
                  }
                }
              }
            },

            failed: {
              exit: 'resetTokenRefresherError'
            }
          }
        }
      }
    },

    {
      actions: {
        // * Persist the refresh token outside of the machine
        persist: (_, { data }) => {
          storageSetter(NHOST_REFRESH_TOKEN_KEY, data?.refreshToken, { ssr })
        },
        save: assign({
          token: (_, event) => event.data?.refreshToken,
          expiration: (_, event) => expiration(event.data?.accessTokenExpiresIn)
        }),
        tick: assign({
          elapsed: (ctx) => ctx.elapsed + 1
        }),
        resetTimer: assign({
          elapsed: (_) => 0,
          attempts: (_) => 0
        }),
        resetToken: assign({
          token: (_) => null
        }),

        retry: assign({
          expiration: (_) => REFRESH_TOKEN_RETRY_INTERVAL,
          elapsed: (_) => 0,
          attempts: (ctx) => ctx.attempts + 1
        }),
        // TODO types
        sendError: sendParent((_, { data: { error } }: any) => ({
          type: 'TOKEN_REFRESH_ERROR',
          error
        })),
        // TODO types
        emit: sendParent((_, { data }: any) => ({
          type: 'SESSION_UPDATE',
          data: { session: data }
        }))
      },
      guards: {
        noToken: (ctx) => !ctx.token,
        token: (ctx) => !!ctx.token,
        shouldRefresh: (ctx) => ctx.elapsed > ctx.expiration,
        // TODO types
        canRetry: (ctx, event: any) => {
          const remainingAttempts = ctx.attempts < REFRESH_TOKEN_RETRY_MAX_ATTEMPTS
          const isNetworkError = event.data.error.status === NETWORK_ERROR_CODE
          return remainingAttempts && isNetworkError
        }
      },
      services: {
        // TODO find a way not to store the token in the context before refreshing it
        refreshToken: async (ctx, e: any) => {
          const token = e.token || ctx.token
          if (ssr && typeof window !== 'undefined') {
            // TODO don't hardcode '/_refresh'
            try {
              const { data } = await axios.get(`${window.location.origin}/_refresh`, {
                withCredentials: true
              })
              return {
                ...data,
                refreshToken: '__cookie__'
              }
            } catch {
              console.warn('Error in ssr /_refresh')
            }
          }
          const result = await api.post('/v1/auth/token', {
            refreshToken: token
          })

          return result.data
        }
      }
    }
  )
