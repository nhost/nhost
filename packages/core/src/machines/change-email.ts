import { assign, createMachine, send } from 'xstate'

import { Nhost } from '../client'
import { ErrorPayload, INVALID_EMAIL_ERROR } from '../errors'
import { nhostApiClient } from '../hasura-auth'
import { ChangeEmailOptions } from '../types'
import { isValidEmail } from '../validators'

export type ChangeEmailContext = {
  error: ErrorPayload | null
}

export type ChangeEmailEvents = {
  type: 'REQUEST'
  email?: string
  options?: ChangeEmailOptions
}
  | { type: 'SUCCESS' }
  | { type: 'ERROR', error: ErrorPayload | null }

export const createChangeEmailMachine = ({ backendUrl, clientUrl, interpreter }: Nhost) => {
  const api = nhostApiClient(backendUrl)
  return createMachine(
    {
      schema: {
        context: {} as ChangeEmailContext,
        events: {} as ChangeEmailEvents
      },
      tsTypes: {} as import("./change-email.typegen").Typegen0,
      preserveActionOrder: true,
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
          // TODO type
          error: (_, { data: { error } }: any) => error
        }),
        reportError: send((ctx) => ({ type: 'ERROR', error: ctx.error })),
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
              options: {
                redirectTo: options?.redirectTo?.startsWith('/')
                  ? clientUrl + options.redirectTo
                  : options?.redirectTo
              }
            },
            {
              headers: {
                authorization: `Bearer ${interpreter?.state.context.accessToken.value}`
              }
            }
          )
          return res.data
        }
      }
    }
  )
}
