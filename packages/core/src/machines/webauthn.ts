import { assign, createMachine, send } from 'xstate'

import { startRegistration } from '@simplewebauthn/browser'
import {
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

export type WebAuthnServices = {
  requestChallenge: { data: PublicKeyCredentialCreationOptionsJSON }
  startRegistration: { data: RegistrationCredentialJSON }
}

export type WebAuthnMachine = ReturnType<typeof createWebAuthnMachine>

export const createWebAuthnMachine = ({ backendUrl, interpreter }: AuthClient) => {
  const api = nhostApiClient(backendUrl)
  return createMachine(
    {
      schema: {
        context: {} as WebAuthnContext,
        events: {} as WebAuthnEvents,
        services: {} as WebAuthnServices
      },
      tsTypes: {} as import('./webauthn.typegen').Typegen0,
      preserveActionOrder: true,
      id: 'webAuthn',
      initial: 'idle',
      context: { error: null },
      states: {
        idle: {
          on: {
            REQUEST: 'requestingChallenge'
          },
          initial: 'initial',
          states: {
            initial: {},
            success: {},
            error: {}
          }
        },
        requestingChallenge: {
          entry: 'clearContext',
          invoke: {
            src: 'requestChallenge',
            id: 'requestChallenge',
            onDone: { target: 'registeringDevice' },
            onError: {
              actions: ['saveError', 'reportError'],
              target: 'idle.error'
            }
          }
        },
        registeringDevice: {
          invoke: {
            src: 'startRegistration',
            id: 'startRegistration',
            onDone: { target: 'verifyingChallenge' },
            onError: {
              actions: ['saveError', 'reportError'],
              target: 'idle.error'
            }
          }
        },
        verifyingChallenge: {
          invoke: {
            src: 'verifyChallenge',
            id: 'verifyChallenge',
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
        requestChallenge: async (_) => {
          const res = await api.post<PublicKeyCredentialCreationOptionsJSON>(
            '/user/webauthn/add',
            {},
            {
              headers: {
                authorization: `Bearer ${interpreter?.state.context.accessToken.value}`
              }
            }
          )
          return res.data
        },
        startRegistration: async (_, { data }) => {
          try {
            return await startRegistration(data!)
          } catch (e) {
            throw new CodifiedError(e as Error)
          }
        },
        verifyChallenge: async (_, { data }) => {
          // TODO Make sure WebAuthn signin is not allowed for anonymous users
          await api.post<SignInResponse>(
            '/user/webauthn/verify',
            { credential: data },
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
