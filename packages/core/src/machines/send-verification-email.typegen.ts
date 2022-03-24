// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    saveInvalidEmailError: 'REQUEST'
    reportSuccess: 'done.invoke.request'
    saveRequestError: 'error.platform.request'
    reportError: 'error.platform.request'
  }
  internalEvents: {
    'done.invoke.request': {
      type: 'done.invoke.request'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.request': { type: 'error.platform.request'; data: unknown }
    'xstate.init': { type: 'xstate.init' }
  }
  invokeSrcNameMap: {
    request: 'done.invoke.request'
  }
  missingImplementations: {
    actions: never
    services: never
    guards: never
    delays: never
  }
  eventsCausingServices: {
    request: 'REQUEST'
  }
  eventsCausingGuards: {
    invalidEmail: 'REQUEST'
  }
  eventsCausingDelays: {}
  matchesStates:
    | 'idle'
    | 'idle.initial'
    | 'idle.success'
    | 'idle.error'
    | 'requesting'
    | { idle?: 'initial' | 'success' | 'error' }
  tags: never
}
