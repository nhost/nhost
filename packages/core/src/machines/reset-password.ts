import { assign, createMachine, send } from 'xstate'

import { AuthClient } from '../client'
import { ErrorPayload } from '../errors'
import { nhostApiClient } from '../hasura-auth'
import { ResetPasswordOptions } from '../types'
import { rewriteRedirectTo } from '../utils'

export type ResetPasswordContext = {
  error: ErrorPayload | null
}
export type ResetPasswordEvents =
  | {
      type: 'REQUEST'
      email?: string
      options?: ResetPasswordOptions
    }
  | { type: 'SUCCESS' }
  | { type: 'ERROR'; error: ErrorPayload | null }

export type ResetPasswordMachine = ReturnType<typeof createResetPasswordMachine>

export const createResetPasswordMachine = ({ backendUrl, clientUrl }: AuthClient) => {
  const api = nhostApiClient(backendUrl)
  return createMachine(
    {
      schema: {
        context: {} as ResetPasswordContext,
        events: {} as ResetPasswordEvents
      },
      tsTypes: {} as import('./reset-password.typegen').Typegen0,
      preserveActionOrder: true,
      id: 'changePassword',
      initial: 'idle',
      context: { error: null },
      states: {
        idle: {
          on: {
            REQUEST: 'requesting'
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
        saveRequestError: assign({
          error: (_, { data: { error } }: any) => {
            console.log(error)
            return error
          }
        }),
        reportError: send((ctx) => ({ type: 'ERROR', error: ctx.error })),
        reportSuccess: send('SUCCESS')
      },
      services: {
        requestChange: (_, { email, options }) =>
          api.post<string, { data: { error?: ErrorPayload } }>('/user/password/reset', {
            email,
            options: rewriteRedirectTo(clientUrl, options)
          })
      }
    }
  )
}
