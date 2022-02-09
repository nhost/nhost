import { AxiosInstance } from 'axios'
import { createMachine, sendParent } from 'xstate'
import { ErrorEvent } from './backend-services'
import { isValidEmail } from './validators'

type Context = {}
const initialContext: Context = {}

export const createChangeEmailMachine = (api: AxiosInstance) =>
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
                cond: 'invalidEmail',
                actions: 'sendInvalid'
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
        sendLoading: sendParent('CHANGE_EMAIL_LOADING'),
        sendInvalid: sendParent('CHANGE_EMAIL_INVALID'),
        sendSuccess: sendParent('CHANGE_EMAIL_SUCCESS'),
        sendError: sendParent<Context, any, ErrorEvent>((_, { data: { error } }) => ({
          type: 'CHANGE_EMAIL_ERROR',
          error
        }))
      },
      guards: {
        invalidEmail: (_, { email }) => !isValidEmail(email)
      },
      services: {
        requestChange: async (_, { email, accessToken }) =>
          await api.post(
            '/v1/auth/user/email/change',
            { newPassword: email },
            {
              headers: {
                authorization: `Bearer ${accessToken}`
              }
            }
          )
      }
    }
  )
export type ChangePasswordMachine = typeof createChangeEmailMachine
