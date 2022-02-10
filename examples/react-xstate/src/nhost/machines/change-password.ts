import { AxiosInstance } from 'axios'
import { createMachine, sendParent } from 'xstate'
import { INVALID_PASSWORD_ERROR } from '../errors'
import { isValidPassword } from '../validators'

export type ChangePasswordContext = {}
export type ChangePasswordEvents = { type: 'REQUEST_CHANGE'; password: string; accessToken: string }

export const createChangePasswordMachine = (api: AxiosInstance) =>
  createMachine(
    {
      schema: {
        context: {} as ChangePasswordContext,
        events: {} as ChangePasswordEvents
      },
      tsTypes: {} as import('./change-password.typegen').Typegen0,
      id: 'changePassword',
      initial: 'idle',
      context: {},
      states: {
        idle: {
          on: {
            REQUEST_CHANGE: [
              {
                cond: 'invalidPassword',
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
        sendLoading: sendParent('CHANGE_PASSWORD_LOADING'),
        sendInvalid: sendParent({ type: 'CHANGE_PASSWORD_INVALID', error: INVALID_PASSWORD_ERROR }),
        sendSuccess: sendParent('CHANGE_PASSWORD_SUCCESS'),
        sendError: sendParent(
          // TODO types
          (_, { data: { error } }: any) => ({
            type: 'CHANGE_PASSWORD_ERROR',
            error
          })
        )
      },
      guards: {
        invalidPassword: (_, { password }) => !isValidPassword(password)
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
