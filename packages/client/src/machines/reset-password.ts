import { assign, createMachine } from 'xstate'

import { Nhost } from '../client'
import { ErrorPayload } from '../errors'
import { nhostApiClient } from '../hasura-auth'
import { ResetPasswordOptions } from '../types'

export type ResetPasswordContext = {
  error: ErrorPayload | null
}
export type ResetPasswordEvents = {
  type: 'REQUEST_CHANGE'
  email?: string
  options?: ResetPasswordOptions
}

export const createResetPasswordMachine = ({ backendUrl, clientUrl }: Nhost) => {
  const api = nhostApiClient(backendUrl)
  return createMachine(
    {
      schema: {
        context: {} as ResetPasswordContext,
        events: {} as ResetPasswordEvents
      },
      tsTypes: {} as import('./reset-password.typegen').Typegen0,
      id: 'changePassword',
      initial: 'idle',
      context: { error: null },
      states: {
        idle: {
          on: {
            REQUEST_CHANGE: 'requesting'
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
        saveRequestError: assign({
          // TODO type
          error: (_, { data: { error } }: any) => {
            console.log(error)
            return error
          }
        })
      },
      services: {
        requestChange: (_, { email, options }) =>
          api.post<string, { data: { error?: ErrorPayload } }>('/v1/auth/user/password/reset', {
            email,
            options: {
              redirectTo: options?.redirectTo?.startsWith('/')
                ? clientUrl + options.redirectTo
                : options?.redirectTo
            }
          })
      }
    }
  )
}
