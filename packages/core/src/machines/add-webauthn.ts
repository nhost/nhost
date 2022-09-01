import { assign, createMachine, send } from 'xstate'

import { startRegistration } from '@simplewebauthn/browser'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationCredentialJSON
} from '@simplewebauthn/typescript-types'

import { AuthClient } from '../client'
import { CodifiedError, ErrorPayload } from '../errors'
import { nhostApiClient } from '../hasura-auth'
import { SignInResponse } from '../types'

export type WebAuthnContext = {
  error: ErrorPayload | null
}

export type WebAuthnEvents =
  | { type: 'REQUEST' }
  | { type: 'SUCCESS' }
  | { type: 'ERROR'; error: ErrorPayload }

export type WebAuthnMachine = ReturnType<typeof createAddWebAuthnMachine>

export const createAddWebAuthnMachine = ({ backendUrl, interpreter }: AuthClient) => {
  const api = nhostApiClient(backendUrl)
  return createMachine(
    {
      schema: {
        context: {} as WebAuthnContext,
        events: {} as WebAuthnEvents
      },
      tsTypes: {} as import('./add-webauthn.typegen').Typegen0,
      preserveActionOrder: true,
      id: 'webAuthn',
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
          entry: 'clearContext',
          invoke: {
            src: 'request',
            id: 'request',
            onDone: { target: 'idle.success', actions: 'reportSuccess' },
            onError: {
              actions: ['saveError', 'reportError'],
              target: 'idle.error'
            }
          }
        }
      }
    },
    {
      actions: {
        clearContext: assign((_) => ({ error: null })),
        // * Untyped action payload. See https://github.com/statelyai/xstate/issues/3037
        saveError: assign((_, e: any) => ({ error: e.data.error })),
        reportError: send((ctx) => ({ type: 'ERROR', error: ctx.error })),
        reportSuccess: send('SUCCESS')
      },
      services: {
        request: async (_) => {
          const { data } = await api.post<PublicKeyCredentialCreationOptionsJSON>(
            '/user/webauthn/add',
            {},
            {
              headers: {
                authorization: `Bearer ${interpreter?.state.context.accessToken.value}`
              }
            }
          )
          let credential: RegistrationCredentialJSON
          try {
            credential = await startRegistration(data!)
          } catch (e) {
            throw new CodifiedError(e as Error)
          }
          await api.post<SignInResponse>(
            '/user/webauthn/verify',
            { credential },
            {
              headers: {
                authorization: `Bearer ${interpreter?.state.context.accessToken.value}`
              }
            }
          )
        }
      }
    }
  )
}
