import { assign } from '@xstate/immer'
import { ActionFunctionMap, StatesConfig } from 'xstate'
import { NhostContext } from '../context'

export const changePasswordConfig: StatesConfig<NhostContext, any, any> = {
  changePassword: {
    initial: 'idle',
    states: {
      idle: {
        initial: 'noErrors',
        on: {
          CHANGE_PASSWORD: [
            {
              cond: 'invalidPassword',
              target: '.invalidPassword'
            },
            {
              target: 'requesting',
              actions: 'savePassword'
            }
          ]
        },
        states: {
          noErrors: {},
          success: {},
          failed: {
            exit: 'resetNewPasswordError'
          },
          invalidPassword: {}
        }
      },

      requesting: {
        invoke: {
          id: 'changePassword',
          src: 'changePassword',
          onDone: 'idle.success',
          onError: {
            target: 'failing',
            actions: 'saveNewPasswordError'
          }
        }
      },
      failing: {
        always: [
          // TODO capture error types
          'idle.failed'
        ]
      }
    }
  }
}

export const changePasswordActions: ActionFunctionMap<NhostContext, any, any> = {
  saveNewPasswordError: assign((ctx, { data: { error } }) => {
    ctx.newPassword.error = error
  }),
  resetNewPasswordError: assign((ctx) => {
    ctx.newPassword.error = null
  })
}
