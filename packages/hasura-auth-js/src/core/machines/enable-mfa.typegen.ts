// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  internalEvents: {
    'done.invoke.activate': {
      type: 'done.invoke.activate'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.generate': {
      type: 'done.invoke.generate'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.activate': { type: 'error.platform.activate'; data: unknown }
    'error.platform.generate': { type: 'error.platform.generate'; data: unknown }
    'xstate.init': { type: 'xstate.init' }
  }
  invokeSrcNameMap: {
    activate: 'done.invoke.activate'
    generate: 'done.invoke.generate'
  }
  missingImplementations: {
    actions: never
    services: never
    guards: never
    delays: never
  }
  eventsCausingActions: {
    reportError: 'error.platform.activate'
    reportGeneratedError: 'error.platform.generate'
    reportGeneratedSuccess: 'done.invoke.generate'
    reportSuccess: 'done.invoke.activate'
    saveError: 'error.platform.activate' | 'error.platform.generate'
    saveGeneration: 'done.invoke.generate'
    saveInvalidMfaCodeError: 'ACTIVATE'
    saveInvalidMfaTypeError: 'ACTIVATE'
  }
  eventsCausingServices: {
    activate: 'ACTIVATE'
    generate: 'GENERATE'
  }
  eventsCausingGuards: {
    invalidMfaCode: 'ACTIVATE'
    invalidMfaType: 'ACTIVATE'
  }
  eventsCausingDelays: {}
  matchesStates:
    | 'generated'
    | 'generated.activated'
    | 'generated.activating'
    | 'generated.idle'
    | 'generated.idle.error'
    | 'generated.idle.idle'
    | 'generating'
    | 'idle'
    | 'idle.error'
    | 'idle.initial'
    | {
        generated?: 'activated' | 'activating' | 'idle' | { idle?: 'error' | 'idle' }
        idle?: 'error' | 'initial'
      }
  tags: never
}
