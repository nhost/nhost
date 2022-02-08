import { assign } from '@xstate/immer'
import { ActionFunctionMap, StatesConfig } from 'xstate'
import { REFRESH_TOKEN_RETRY_INTERVAL, REFRESH_TOKEN_RETRY_MAX_ATTEMPTS } from '../constants'
import { NhostContext } from '../context'

export const tokenRefresherConfig: StatesConfig<NhostContext, any, any> = {
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

export const tokenRefresherActions: ActionFunctionMap<NhostContext, any, any> = {
  // * 'Token timer' errors
  resetTokenRefresherError: assign((ctx) => {
    ctx.refreshToken.timer.error = null
  }),
  saveTokenTimerError: assign((ctx, { data: { error } }) => {
    ctx.refreshToken.timer.error = error
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
  })
}

export const tokenRefresherGuards: Record<string, (ctx: NhostContext, e: any) => boolean> = {
  // * Context guards
  shouldStartTokenTimer: (ctx) => !!ctx.refreshToken.value,
  shouldWaitForToken: (ctx) => !ctx.refreshToken.value,
  shouldRefreshToken: (ctx) =>
    ctx.refreshToken.timer.elapsed >= ctx.accessToken.expiresIn || !ctx.user,
  // * Refresh token timer errors
  tokenRefresherNetworkError: (ctx, e) => ctx.refreshToken.timer.error?.status === 0,
  // can retry token refresh only if number of attempts is not reached, and there is a network error
  canRetryTokenRefresh: (ctx, event) => {
    const remainingAttempts = ctx.refreshToken.timer.attempts < REFRESH_TOKEN_RETRY_MAX_ATTEMPTS
    const isNetworkError = !event.data.response && !event.data.request.status
    return remainingAttempts && isNetworkError
  }
}
