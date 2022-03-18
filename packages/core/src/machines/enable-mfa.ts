import { assign, createMachine, send } from 'xstate'

import { AuthClient } from '../client'
import { ErrorPayload, INVALID_MFA_TYPE_ERROR } from '../errors'
import { nhostApiClient } from '../hasura-auth'

export type EnableMfaContext = {
  error: ErrorPayload | null
  imageUrl: string | null
  secret: string | null
}

export type EnableMfaEvents =
  | {
      type: 'GENERATE'
    }
  | {
      type: 'ACTIVATE'
      code?: string
      activeMfaType: 'totp'
    }
  | { type: 'GENERATED' }
  | { type: 'GENERATED_ERROR'; error: ErrorPayload | null }
  | { type: 'SUCCESS' }
  | { type: 'ERROR'; error: ErrorPayload | null }

export const createEnableMfaMachine = ({ backendUrl, interpreter }: AuthClient) => {
  const api = nhostApiClient(backendUrl)
  return createMachine(
    {
      schema: {
        context: {} as EnableMfaContext,
        events: {} as EnableMfaEvents
      },
      tsTypes: {} as import('./enable-mfa.typegen').Typegen0,
      preserveActionOrder: true,
      id: 'enableMfa',
      initial: 'idle',
      context: { error: null, imageUrl: null, secret: null },
      states: {
        idle: {
          initial: 'initial',
          on: {
            GENERATE: 'generating'
          },
          states: {
            initial: {},
            error: {}
          }
        },
        generating: {
          invoke: {
            src: 'generate',
            id: 'generate',
            onDone: { target: 'generated', actions: ['reportGeneratedSuccess', 'saveGeneration'] },
            onError: { actions: ['saveError', 'reportGeneratedError'], target: 'idle.error' }
          }
        },
        generated: {
          initial: 'idle',
          states: {
            idle: {
              initial: 'idle',
              on: {
                ACTIVATE: [
                  {
                    cond: 'invalidMfaType',
                    actions: 'saveInvalidMfaTypeError',
                    target: '.error'
                  },
                  {
                    target: 'activating'
                  }
                ]
              },
              states: { idle: {}, error: {} }
            },
            activating: {
              invoke: {
                src: 'activate',
                id: 'activate',
                onDone: { target: 'activated', actions: 'reportSuccess' },
                onError: { actions: ['saveError', 'reportError'], target: 'idle.error' }
              }
            },
            activated: { type: 'final' }
          }
        }
      }
    },
    {
      actions: {
        saveInvalidMfaTypeError: assign({ error: (_) => INVALID_MFA_TYPE_ERROR }),
        saveError: assign({
          error: (_, { data: { error } }: any) => error
        }),
        saveGeneration: assign({
          imageUrl: (_, { data: { imageUrl } }: any) => imageUrl,
          secret: (_, { data: { totpSecret } }: any) => totpSecret
        }),
        reportError: send((ctx) => ({ type: 'ERROR', error: ctx.error })),
        reportSuccess: send('SUCCESS'),
        reportGeneratedSuccess: send('GENERATED'),
        reportGeneratedError: send((ctx) => ({ type: 'GENERATED_ERROR', error: ctx.error }))
      },
      guards: {
        invalidMfaType: (_, { activeMfaType }) => !activeMfaType || activeMfaType !== 'totp'
      },
      services: {
        generate: async (_) => {
          const { data } = await api.get('/mfa/totp/generate', {
            headers: {
              authorization: `Bearer ${interpreter?.state.context.accessToken.value}`
            }
          })
          return data
        },
        activate: (_, { code, activeMfaType }) =>
          api.post(
            '/user/mfa',
            {
              code,
              activeMfaType
            },
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
