import { createMachine, sendParent } from 'xstate'
import { NhostEvents } from './events'

export type UrlParserContext = {}
type UrlParserEvents = { type: string }
export const urlParser = createMachine(
  {
    schema: {
      context: {} as UrlParserContext,
      events: {} as UrlParserEvents
    },
    tsTypes: {} as import('./url-parser.typegen').Typegen0,
    initial: 'start',
    states: {
      start: {
        invoke: {
          id: 'parser',
          src: 'parser',
          onDone: {
            target: 'end',
            actions: 'emitToken'
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
    actions: {
      emitToken: sendParent<UrlParserContext, any, NhostEvents>((_, e) => ({
        type: 'TRY_TOKEN',
        token: e.data
      }))
    },
    services: {
      parser: async () => {
        if (typeof window !== 'undefined') {
          const location = window.location
          if (location.hash) {
            const params = new URLSearchParams(location.hash.slice(1))
            const token = params.get('refreshToken')
            if (token) {
              const type = params.get('type')
              if (
                type === 'signinPasswordless' ||
                type === 'emailVerify' ||
                type === 'emailConfirmChange'
              ) {
                console.log(token)
                // TODO send somehow the information to other tabs
                //   authService.send({ type: 'TRY_TOKEN', token })
                // * remove hash from the current url after consumming the token
                window.history.pushState({}, '', location.pathname)
                return token
              } else {
                console.warn(
                  `Found a refresh token in the url but the redirect type is not implemented: ${type}`
                )
              }
            }
          }
          throw Error()
        }
      }
    }
  }
)
