// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    sendInvalid: 'REQUEST_CHANGE'
    sendSuccess: 'done.invoke.requestChange'
    sendError: 'error.platform.requestChange'
    sendLoading: 'REQUEST_CHANGE'
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
    requestChange: 'REQUEST_CHANGE'
  }
  eventsCausingGuards: {
    invalidPassword: 'REQUEST_CHANGE'
  }
  eventsCausingDelays: {}
  matchesStates: 'idle' | 'requesting'
  tags: never
}
