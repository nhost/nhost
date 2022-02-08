import { assign } from '@xstate/immer'
import { ActionFunctionMap, StatesConfig } from 'xstate'
import { NhostContext } from '../context'

export const changeEmailConfig: StatesConfig<NhostContext, any, any> = {
  changeEmail: {
    initial: 'idle',
    states: {
      idle: {
        initial: 'noErrors',
        on: {
          CHANGE_EMAIL: [
            {
              cond: 'invalidEmail',
              target: '.invalidEmail'
            },
            {
              target: 'requesting',
              actions: 'saveEmail'
            }
          ]
        },
        states: {
          noErrors: {},
          failed: {
            exit: 'resetNewEmailError'
          },
          invalidEmail: {}
        }
      },

      requesting: {
        invoke: {
          id: 'requestNewEmail',
          src: 'requestNewEmail',
          onDone: 'awaitingVerification',
          onError: {
            target: 'failing',
            actions: 'saveNewEmailError'
          }
        }
      },
      failing: {
        always: [
          // TODO capture error types
          'idle.failed'
        ]
      },
      awaitingVerification: {
        // TODO change back state to idle when email is verified?
      }
    }
  }
}

export const changeEmailActions: ActionFunctionMap<NhostContext, any, any> = {
  // * 'New email' errors
  saveNewEmailError: assign((ctx, { data: { error } }) => {
    ctx.newEmail.error = error
  }),
  resetNewEmailError: assign((ctx) => {
    ctx.newEmail.error = null
  })
}
