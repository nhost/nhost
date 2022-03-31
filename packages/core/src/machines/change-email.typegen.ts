// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    saveInvalidEmailError: 'REQUEST'
    reportSuccess: 'done.invoke.requestChange'
    saveRequestError: 'error.platform.requestChange'
    reportError: 'error.platform.requestChange'
  }
  internalEvents: {
    'done.invoke.requestChange': {
      type: 'done.invoke.requestChange'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.requestChange': { type: 'error.platform.requestChange'; data: unknown }
    'xstate.init': { type: 'xstate.init' }
  }
  invokeSrcNameMap: {
    requestChange: 'done.invoke.requestChange'
  }
  missingImplementations: {
    actions: never
    services: never
    guards: never
    delays: never
  }
  eventsCausingServices: {
    requestChange: 'REQUEST'
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
