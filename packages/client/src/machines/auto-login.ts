import { BroadcastChannel } from 'broadcast-channel'
import { createMachine, sendParent } from 'xstate'

import { NhostEvents } from './events'

export type AutoLoginContext = {}
export type AutoLoginOption = boolean
type AutoLoginEvents = { type: string }

export const createAutoLoginMachine = ({ autoLogin }: { autoLogin: AutoLoginOption }) => {
  return createMachine(
    {
      schema: {
        context: {} as AutoLoginContext,
        events: {} as AutoLoginEvents
      },
      tsTypes: {} as import('./auto-login.typegen').Typegen0,
      initial: 'start',
      states: {
        start: {
          always: [{ cond: 'enabled', target: 'parsing' }, 'disabled']
        },
        disabled: {
          type: 'final'
        },
        parsing: {
          invoke: {
            id: 'parser',
            src: 'parser',
            onDone: {
              target: 'end',
              actions: ['emitToken', 'broadcastToken']
            },
            onError: 'end'
          }
        },
        end: {
          type: 'final'
        }
      }
    },
    {
      guards: {
        enabled: () => !!autoLogin
      },
      actions: {
        emitToken: sendParent<AutoLoginContext, any, NhostEvents>((_, e) => ({
          type: 'TRY_TOKEN',
          token: e.data
        })),
        broadcastToken: async (_, e) => {
          const channel = new BroadcastChannel('nhost')
          await channel.postMessage(e.data)
        }
      },
      services: {
        parser: async () => {
          if (typeof window !== 'undefined') {
            const location = window.location
            if (location.hash) {
              const params = new URLSearchParams(location.hash.slice(1))
              const token = params.get('refreshToken')
              if (token) {
                // const type = params.get('type')
                // if (!['signinPasswordless', 'emailVerify', 'emailConfirmChange'].includes(type)) {
                //   console.warn(
                //     `Found a refresh token in the url but the redirect type is not implemented: ${type}`,
                //     location.hash
                //   )
                // }
                //   interpreter.send({ type: 'TRY_TOKEN', token })
                // * remove hash from the current url after consumming the token
                window.history.pushState({}, '', location.pathname)
                return token
              }
            }
            throw Error()
          }
        }
      }
    }
  )
}
