// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    emitToken: 'done.invoke.parser'
  }
  internalEvents: {
    'done.invoke.parser': {
      type: 'done.invoke.parser'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'xstate.init': { type: 'xstate.init' }
    'error.platform.parser': { type: 'error.platform.parser'; data: unknown }
  }
  invokeSrcNameMap: {
    parser: 'done.invoke.parser'
  }
  missingImplementations: {
    actions: never
    services: never
    guards: never
    delays: never
  }
  eventsCausingServices: {
    parser: 'xstate.init'
  }
  eventsCausingGuards: {}
  eventsCausingDelays: {}
  matchesStates: 'start' | 'end'
  tags: never
}
