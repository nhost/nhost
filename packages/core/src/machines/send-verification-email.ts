import { assign, createMachine, send } from 'xstate'

import { AuthClient } from '../client'
import { ErrorPayload, INVALID_EMAIL_ERROR } from '../errors'
import { nhostApiClient } from '../hasura-auth'
import { SendVerificationEmailOptions } from '../types'
import { rewriteRedirectTo } from '../utils'
import { isValidEmail } from '../validators'

export type SendVerificationEmailContext = {
  error: ErrorPayload | null
}

export type SendVerificationEmailEvents =
  | {
      type: 'REQUEST'
      email?: string
      options?: SendVerificationEmailOptions
    }
  | { type: 'SUCCESS' }
  | { type: 'ERROR'; error: ErrorPayload | null }

export type SendVerificationEmailMachine = ReturnType<typeof createSendVerificationEmailMachine>
export const createSendVerificationEmailMachine = ({ backendUrl, clientUrl }: AuthClient) => {
  const api = nhostApiClient(backendUrl)
  return createMachine(
    {
      schema: {
        context: {} as SendVerificationEmailContext,
        events: {} as SendVerificationEmailEvents
      },
      tsTypes: {} as import('./send-verification-email.typegen').Typegen0,
      predictableActionArguments: true,
      id: 'sendVerificationEmail',
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
            src: 'request',
            id: 'request',
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
          error: (_, { data: { error } }: any) => error
        }),
        reportError: send((ctx) => ({ type: 'ERROR', error: ctx.error })),
        reportSuccess: send('SUCCESS')
      },
      guards: {
        invalidEmail: (_, { email }) => !isValidEmail(email)
      },
      services: {
        request: async (_, { email, options }) => {
          const res = await api.post('/user/email/send-verification-email', {
            email,
            options: rewriteRedirectTo(clientUrl, options)
          })
          return res.data
        }
      }
    }
  )
}
