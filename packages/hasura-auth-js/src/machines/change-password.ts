import { assign, createMachine, send } from 'xstate'

import { INVALID_PASSWORD_ERROR } from '../errors'
import { AuthClient } from '../internal-client'
import { ChangePasswordResponse, ErrorPayload } from '../types'
import { nhostApiClient } from '../utils'
import { isValidPassword } from '../utils/validators'

export type ChangePasswordContext = {
  error: ErrorPayload | null
}
export type ChangePasswordEvents =
  | {
      type: 'REQUEST'
      password?: string
      ticket?: string
    }
  | { type: 'SUCCESS' }
  | { type: 'ERROR'; error: ErrorPayload | null }

export type ChangePasswordServices = {
  requestChange: { data: ChangePasswordResponse }
}

export type ChangePasswordMachine = ReturnType<typeof createChangePasswordMachine>

export const createChangePasswordMachine = ({ backendUrl, interpreter }: AuthClient) => {
  const api = nhostApiClient(backendUrl)
  return createMachine(
    {
      schema: {
        context: {} as ChangePasswordContext,
        events: {} as ChangePasswordEvents,
        services: {} as ChangePasswordServices
      },
      tsTypes: {} as import('./change-password.typegen').Typegen0,
      predictableActionArguments: true,
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
          // * Untyped action payload. See https://github.com/statelyai/xstate/issues/3037
          error: (_, { data: { error } }: any) => error
        }),
        reportError: send((ctx) => ({ type: 'ERROR', error: ctx.error })),
        reportSuccess: send('SUCCESS')
      },
      guards: {
        invalidPassword: (_, { password }) => !isValidPassword(password)
      },
      services: {
        requestChange: (_, { password, ticket }) =>
          api.post<string, ChangePasswordResponse>(
            '/user/password',
            { newPassword: password, ticket: ticket },
            {
              headers: {
                authorization: `Bearer ${interpreter?.getSnapshot().context.accessToken.value}`
              }
            }
          )
      }
    }
  )
}
