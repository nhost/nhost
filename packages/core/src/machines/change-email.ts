import { assign, createMachine, send } from 'xstate'

import { AuthClient } from '../client'
import { ErrorPayload, INVALID_EMAIL_ERROR } from '../errors'
import { nhostApiClient } from '../hasura-auth'
import { ChangeEmailOptions, ChangeEmailResponse } from '../types'
import { rewriteRedirectTo } from '../utils'
import { isValidEmail } from '../validators'

export type ChangeEmailContext = {
  error: ErrorPayload | null
}

export type ChangeEmailEvents =
  | {
      type: 'REQUEST'
      email?: string
      options?: ChangeEmailOptions
    }
  | { type: 'SUCCESS' }
  | { type: 'ERROR'; error: ErrorPayload | null }

export type ChangeEmailServices = {
  request: { data: ChangeEmailResponse }
}

export type ChangeEmailMachine = ReturnType<typeof createChangeEmailMachine>

export const createChangeEmailMachine = ({ backendUrl, clientUrl, interpreter }: AuthClient) => {
  const api = nhostApiClient(backendUrl)
  return createMachine(
    {
      schema: {
        context: {} as ChangeEmailContext,
        events: {} as ChangeEmailEvents,
        services: {} as ChangeEmailServices
      },
      tsTypes: {} as import('./change-email.typegen').Typegen0,
      predictableActionArguments: true,
      id: 'changeEmail',
      initial: 'idle',
      context: { error: null },
      states: {
        idle: {
          on: {
            REQUEST: [
              {
                cond: 'invalidEmail',
                actions: 'saveInvalidEmailError',
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
        saveInvalidEmailError: assign({ error: (_) => INVALID_EMAIL_ERROR }),
        saveRequestError: assign({
          // * Untyped action payload. See https://github.com/statelyai/xstate/issues/3037
          error: (_, { data: { error } }: any) => error
        }),
        reportError: send((ctx) => ({ type: 'ERROR', error: ctx.error })),
        // TODO change email in the main machine (context.user.email)
        reportSuccess: send('SUCCESS')
      },
      guards: {
        invalidEmail: (_, { email }) => !isValidEmail(email)
      },
      services: {
        requestChange: async (_, { email, options }) => {
          const res = await api.post(
            '/user/email/change',
            {
              newEmail: email,
              options: rewriteRedirectTo(clientUrl, options)
            },
            {
              headers: {
                authorization: `Bearer ${interpreter?.getSnapshot().context.accessToken.value}`
              }
            }
          )
          return res.data
        }
      }
    }
  )
}
