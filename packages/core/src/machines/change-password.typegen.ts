// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
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
  eventsCausingActions: {
    reportError: 'error.platform.requestChange'
    reportSuccess: 'done.invoke.requestChange'
    saveInvalidPasswordError: 'REQUEST'
    saveRequestError: 'error.platform.requestChange'
  }
  eventsCausingServices: {
    requestChange: 'REQUEST'
  }
  eventsCausingGuards: {
    invalidPassword: 'REQUEST'
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
