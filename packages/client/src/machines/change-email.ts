import type { AxiosInstance } from 'axios'
import { createMachine, sendParent } from 'xstate'

import { INVALID_EMAIL_ERROR } from '../errors'
import { isValidEmail } from '../validators'

export type ChangeEmailContext = {
  test?: string
}
export type ChangeEmailEvents = {
  type: 'REQUEST_CHANGE'
  email: string
  accessToken: string | null
}

export const createChangeEmailMachine = (api: AxiosInstance) =>
  createMachine(
    {
      schema: {
        context: {} as ChangeEmailContext,
        events: {} as ChangeEmailEvents
      },
      tsTypes: {} as import('./change-email.typegen').Typegen0,
      id: 'changeEmail',
      initial: 'idle',
      context: {},
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
        sendInvalid: sendParent({ type: 'CHANGE_EMAIL_INVALID', error: INVALID_EMAIL_ERROR }),
        sendSuccess: sendParent('CHANGE_EMAIL_SUCCESS'),
        sendError: sendParent(
          // TODO types
          (_, { data: { error } }: any) => ({
            type: 'CHANGE_EMAIL_ERROR',
            error
          })
        )
      },
      guards: {
        invalidEmail: (_, { email }) => !isValidEmail(email)
      },
      services: {
        requestChange: async (_, { email, accessToken }) => {
          const res = await api.post(
            '/v1/auth/user/email/change',
            { newEmail: email },
            {
              headers: {
                authorization: `Bearer ${accessToken}`
              }
            }
          )
          return res.data
        }
      }
    }
  )
