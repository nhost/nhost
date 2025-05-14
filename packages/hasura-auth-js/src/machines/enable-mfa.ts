import { assign, createMachine, send } from 'xstate'
import { INVALID_MFA_CODE_ERROR, INVALID_MFA_TYPE_ERROR } from '../errors'
import { AuthClient } from '../internal-client'
import { AuthErrorPayload } from '../types'
import { getFetch, postFetch } from '../utils'

export type EnableMfaContext = {
  error: AuthErrorPayload | null
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
  | { type: 'DISABLE'; code: string }
  | { type: 'GENERATED' }
  | { type: 'GENERATED_ERROR'; error: AuthErrorPayload | null }
  | { type: 'SUCCESS' }
  | { type: 'ERROR'; error: AuthErrorPayload | null }

export type EnableMfadMachine = ReturnType<typeof createEnableMfaMachine>

export const createEnableMfaMachine = ({ backendUrl, interpreter }: AuthClient) => {
  return createMachine(
    {
      schema: {
        context: {} as EnableMfaContext,
        events: {} as EnableMfaEvents
      },
      tsTypes: {} as import('./enable-mfa.typegen').Typegen0,
      predictableActionArguments: true,
      id: 'enableMfa',
      initial: 'idle',
      context: { error: null, imageUrl: null, secret: null },
      states: {
        idle: {
          initial: 'initial',
          on: {
            GENERATE: 'generating',
            DISABLE: 'disabling'
          },
          states: {
            initial: {},
            error: {},
            disabled: {}
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
                    cond: 'invalidMfaCode',
                    actions: 'saveInvalidMfaCodeError',
                    target: '.error'
                  },
                  {
                    target: 'activating'
                  }
                ],
                DISABLE: '#enableMfa.disabling'
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
        },
        disabling: {
          invoke: {
            src: 'disable',
            id: 'disable',
            onDone: { target: 'idle.disabled', actions: 'reportSuccess' },
            onError: { actions: ['saveError', 'reportError'], target: 'idle.error' }
          }
        }
      }
    },
    {
      actions: {
        saveInvalidMfaTypeError: assign({ error: (_) => INVALID_MFA_TYPE_ERROR }),
        saveInvalidMfaCodeError: assign({ error: (_) => INVALID_MFA_CODE_ERROR }),
        saveError: assign({
          error: (_, { data: { error } }: any) => error
        }),
        saveGeneration: assign({
          imageUrl: (_, { data: { imageUrl } }: any) => imageUrl,
          secret: (_, { data: { totpSecret } }: any) => totpSecret
        }),
        reportError: send((ctx, event) => ({ type: 'ERROR', error: ctx.error })),
        reportSuccess: send('SUCCESS'),
        reportGeneratedSuccess: send('GENERATED'),
        reportGeneratedError: send((ctx) => ({ type: 'GENERATED_ERROR', error: ctx.error }))
      },
      guards: {
        invalidMfaCode: (_, { code }) => !code,
        invalidMfaType: (_, { activeMfaType }) => !activeMfaType || activeMfaType !== 'totp'
      },
      services: {
        generate: async (_) => {
          const { data } = await getFetch(
            `${backendUrl}/mfa/totp/generate`,
            interpreter?.getSnapshot().context.accessToken.value
          )
          return data
        },
        activate: (_, { code, activeMfaType }) =>
          postFetch(
            `${backendUrl}/user/mfa`,
            { code, activeMfaType },
            interpreter?.getSnapshot().context.accessToken.value
          ),
        disable: (_, { code }) =>
          postFetch(
            `${backendUrl}/user/mfa`,
            { code, activeMfaType: '' },
            interpreter?.getSnapshot().context.accessToken.value
          )
      }
    }
  )
}
