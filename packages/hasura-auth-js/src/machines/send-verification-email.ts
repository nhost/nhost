import { assign, createMachine, send } from 'xstate'

import { INVALID_EMAIL_ERROR } from '../errors'
import { AuthClient } from '../internal-client'
import { ErrorPayload, SendVerificationEmailOptions, SendVerificationEmailResponse } from '../types'
import { nhostApiClient, rewriteRedirectTo } from '../utils'
import { isValidEmail } from '../utils/validators'

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

export type SendVerificationEmailServices = {
  request: { data: SendVerificationEmailResponse }
}

export type SendVerificationEmailMachine = ReturnType<typeof createSendVerificationEmailMachine>
export const createSendVerificationEmailMachine = ({ backendUrl, clientUrl }: AuthClient) => {
  const api = nhostApiClient(backendUrl)
  return createMachine(
    {
      schema: {
        context: {} as SendVerificationEmailContext,
        events: {} as SendVerificationEmailEvents,
        services: {} as SendVerificationEmailServices
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
          // * Untyped action payload. See https://github.com/statelyai/xstate/issues/3037
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
          const res = await api.post<SendVerificationEmailResponse>(
            '/user/email/send-verification-email',
            {
              email,
              options: rewriteRedirectTo(clientUrl, options)
            }
          )
          return res.data
        }
      }
    }
  )
}
