import { validate as uuidValidate } from 'uuid'
import { assign } from '@xstate/immer'
import { ActionFunctionMap, StatesConfig } from 'xstate'
import { NhostContext } from '../context'

export const newRefreshTokenConfig: StatesConfig<NhostContext, any, any> = {
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
  }
}

export const newRefreshTokenActions: ActionFunctionMap<NhostContext, any, any> = {
  resetNewTokenError: assign((ctx) => {
    ctx.refreshToken.newToken.error = null
  }),
  saveNewTokenError: assign((ctx, { data: { error } }) => {
    ctx.refreshToken.newToken.error = error
  })
}

export const newRefreshGuards: Record<string, (ctx: NhostContext, e: any) => boolean> = {
  // * New refresh token errors
  newTokenNetworkError: (ctx, e) => ctx.refreshToken.newToken.error?.status === 0,
  invalidRefreshToken: (_, e) => !uuidValidate(e.token)
}
