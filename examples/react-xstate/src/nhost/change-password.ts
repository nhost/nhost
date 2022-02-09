import { AxiosInstance } from 'axios'
import { createMachine, sendParent } from 'xstate'
import { ErrorEvent } from './backend-services'
import { MIN_PASSWORD_LENGTH } from './constants'

type Context = {
  newPassword: string | null
}
const initialContext: Context = {
  newPassword: null
}
export const createChangePasswordMachine = (api: AxiosInstance) =>
  createMachine(
    {
      id: 'remote',
      initial: 'idle',
      context: initialContext,
      states: {
        idle: {
          on: {
            REQUEST_CHANGE: [
              {
                cond: 'invalidPassword',
                actions: 'sendInvalidPassord'
              },
              {
                target: 'requesting'
              }
            ]
          }
        },
        requesting: {
          entry: 'sendLoading',
          invoke: {
            src: 'requestChange',
            id: 'requestChange',
            onDone: [
              {
                target: 'idle',
                actions: 'sendSuccess'
              }
            ],
            onError: [
              {
                actions: 'sendError',
                target: 'idle'
              }
            ]
          }
        }
      }
    },
    {
      actions: {
        sendLoading: sendParent('PASSWORD_CHANGE_LOADING'),
        sendInvalidPassord: sendParent('PASSWORD_CHANGE_INVALID'),
        sendSuccess: sendParent('PASSWORD_CHANGE_SUCCESS'),
        sendError: sendParent<Context, any, ErrorEvent>((_, { data: { error } }) => ({
          type: 'PASSWORD_CHANGE_ERROR',
          error
        }))
      },
      guards: {
        invalidPassword: (_, e) => !e.password || e.password.length <= MIN_PASSWORD_LENGTH
      },
      services: {
        requestChange: async (_, { password, accessToken }) =>
          await api.post(
            '/v1/auth/user/password',
            { newPassword: password },
            {
              headers: {
                authorization: `Bearer ${accessToken}`
              }
            }
          )
      }
    }
  )
export type ChangePasswordMachine = typeof createChangePasswordMachine
