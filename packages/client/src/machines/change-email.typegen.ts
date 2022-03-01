// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    saveInvalidEmailError: 'REQUEST_CHANGE'
    saveRequestError: 'error.platform.requestChange'
  }
  internalEvents: {
    'error.platform.requestChange': { type: 'error.platform.requestChange'; data: unknown }
    'xstate.init': { type: 'xstate.init' }
    'done.invoke.requestChange': {
      type: 'done.invoke.requestChange'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
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
    requestChange: 'REQUEST_CHANGE'
  }
  eventsCausingGuards: {
    invalidEmail: 'REQUEST_CHANGE'
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
