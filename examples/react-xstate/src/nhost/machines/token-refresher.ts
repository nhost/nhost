import { AxiosInstance } from 'axios'
import { createMachine, sendParent, assign } from 'xstate'
import {
  MIN_TOKEN_REFRESH_INTERVAL,
  NETWORK_ERROR_CODE,
  NHOST_REFRESH_TOKEN,
  REFRESH_TOKEN_RETRY_INTERVAL,
  REFRESH_TOKEN_RETRY_MAX_ATTEMPTS,
  TOKEN_REFRESH_MARGIN
} from '../constants'
import { StorageGetter, StorageSetter } from '../storage'

type TokenRefresherContext = {
  token: string | null
  elapsed: number
  attempts: number
  expiration: number
  session: any
}
type TokenRefresherEvents =
  | { type: 'LOAD_TOKEN'; data: any } // TODO types
  | { type: 'SIGNOUT'; all?: boolean }

const expiration = (expiresIn: number) =>
  Math.max(expiresIn - TOKEN_REFRESH_MARGIN, MIN_TOKEN_REFRESH_INTERVAL)

export const createTokenRefresherMachine = (
  api: AxiosInstance,
  storageGetter: StorageGetter,
  storageSetter: StorageSetter
) =>
  createMachine(
    {
      schema: {
        context: {} as TokenRefresherContext,
        events: {} as TokenRefresherEvents
      },
      tsTypes: {} as import('./token-refresher.typegen').Typegen0,
      id: 'token',
      initial: 'idle',
      context: {
        token: storageGetter(NHOST_REFRESH_TOKEN),
        elapsed: 0,
        attempts: 0,
        expiration: 0,
        session: null
      },
      on: {
        LOAD_TOKEN: {
          // TODO check the new token before saving it
          actions: ['save', 'persist'],
          target: 'idle'
        }
      },
      states: {
        stopped: {
          always: {
            cond: 'noToken',
            target: 'idle'
          }
        },
        idle: {
          always: [
            {
              cond: 'token',
              target: 'running.refreshing'
            }
          ]
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
                  actions: 'reset',
                  target: '#token.stopped'
                }
              }
            },
            refreshing: {
              invoke: {
                src: 'refreshToken',
                id: 'refreshToken',
                onDone: [
                  {
                    actions: ['save', 'reset', 'persist', 'emit'],
                    target: 'pending'
                  }
                ],
                onError: [
                  {
                    actions: 'retry',
                    cond: 'canRetry',
                    target: 'pending'
                  },
                  {
                    actions: ['sendError', 'reset'],
                    target: '#token.stopped'
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
    },

    {
      actions: {
        // * Persist the refresh token outside of the machine
        persist: (_, { data }) => {
          storageSetter(NHOST_REFRESH_TOKEN, data?.refreshToken)
        },
        save: assign({
          token: (_, event) => event.data?.refreshToken,
          expiration: (_, event) => expiration(event.data?.accessTokenExpiresIn)
        }),
        tick: assign({
          elapsed: (ctx) => ctx.elapsed + 1
        }),
        reset: assign({
          elapsed: (_) => 0,
          attempts: (_) => 0
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
        refreshToken: async ({ token }) => {
          const result = await api.post('/v1/auth/token', {
            refreshToken: token
          })

          return result.data
        }
      }
    }
  )
