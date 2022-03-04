import { assign, createMachine } from 'xstate'

import { Nhost } from '../client'
import { ErrorPayload, INVALID_EMAIL_ERROR } from '../errors'
import { nhostApiClient } from '../hasura-auth'
import { ChangeEmailOptions } from '../types'
import { isValidEmail } from '../validators'

export type ChangeEmailContext = {
  error: ErrorPayload | null
}
export type ChangeEmailEvents = {
  type: 'REQUEST_CHANGE'
  email?: string
  options?: ChangeEmailOptions
}

export const createChangeEmailMachine = ({ backendUrl, clientUrl, interpreter }: Nhost) => {
  const api = nhostApiClient(backendUrl)
  return createMachine(
    {
      schema: {
        context: {} as ChangeEmailContext,
        events: {} as ChangeEmailEvents
      },
      tsTypes: {} as import('./change-email.typegen').Typegen0,
      id: 'changeEmail',
      initial: 'idle',
      context: { error: null },
      states: {
        idle: {
          on: {
            REQUEST_CHANGE: [
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
            onDone: 'idle.success',
            onError: { actions: 'saveRequestError', target: 'idle.error' }
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
        })
      },
      guards: {
        invalidEmail: (_, { email }) => !isValidEmail(email)
      },
      services: {
        requestChange: async (_, { email, options }) => {
          const res = await api.post(
            '/v1/auth/user/email/change',
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
