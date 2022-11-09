// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
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
  eventsCausingActions: {
    reportError: 'error.platform.request'
    reportSuccess: 'done.invoke.request'
    saveInvalidEmailError: 'REQUEST'
    saveRequestError: 'error.platform.request'
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
    | 'idle.error'
    | 'idle.initial'
    | 'idle.success'
    | 'requesting'
    | { idle?: 'error' | 'initial' | 'success' }
  tags: never
}
