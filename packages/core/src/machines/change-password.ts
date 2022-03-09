import { assign, createMachine, send } from 'xstate'

import { Nhost } from '../client'
import { ErrorPayload, INVALID_PASSWORD_ERROR } from '../errors'
import { nhostApiClient } from '../hasura-auth'
import { isValidPassword } from '../validators'

export type ChangePasswordContext = {
  error: ErrorPayload | null
}
export type ChangePasswordEvents =
  | {
    type: 'REQUEST'
    password?: string
  }
  | { type: 'SUCCESS' }
  | { type: 'ERROR', error: ErrorPayload | null }

export const createChangePasswordMachine = ({ backendUrl, interpreter }: Nhost) => {
  const api = nhostApiClient(backendUrl)
  return createMachine(
    {
      schema: {
        context: {} as ChangePasswordContext,
        events: {} as ChangePasswordEvents
      },
      tsTypes: {} as import("./change-password.typegen").Typegen0,
      preserveActionOrder: true,
      id: 'changePassword',
      initial: 'idle',
      context: { error: null },
      states: {
        idle: {
          on: {
            REQUEST: [
              {
                cond: 'invalidPassword',
                actions: 'saveInvalidPasswordError',
                target: '.error'
              },
              {
                target: 'requesting'
              }
            ]
          },
          initial: 'initial',
          states: {
            initial: {},
            success: {},
            error: {}
          }
        },
        requesting: {
          invoke: {
            src: 'requestChange',
            id: 'requestChange',
            onDone: { target: 'idle.success', actions: 'reportSuccess' },
            onError: { actions: ['saveRequestError', 'reportError'], target: 'idle.error' }
          }
        }
      }
    },
    {
      actions: {
        saveInvalidPasswordError: assign({ error: (_) => INVALID_PASSWORD_ERROR }),
        saveRequestError: assign({
          // TODO type
          error: (_, { data: { error } }: any) => {
            console.log(error)
            return error
          }
        }),
        reportError: send((ctx) => ({ type: 'ERROR', error: ctx.error })),
        reportSuccess: send('SUCCESS')
      },
      guards: {
        invalidPassword: (_, { password }) => !isValidPassword(password)
      },
      services: {
        requestChange: (_, { password }) =>
          api.post<string, { data: { error?: ErrorPayload } }>(
            '/v1/auth/user/password',
            { newPassword: password },
            {
              headers: {
                authorization: `Bearer ${interpreter?.state.context.accessToken.value}`
              }
            }
          )
      }
    }
  )
}
