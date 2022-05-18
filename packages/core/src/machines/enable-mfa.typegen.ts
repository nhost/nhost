// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    reportGeneratedSuccess: 'done.invoke.generate'
    saveGeneration: 'done.invoke.generate'
    saveError: 'error.platform.generate' | 'error.platform.activate'
    reportGeneratedError: 'error.platform.generate'
    saveInvalidMfaTypeError: 'ACTIVATE'
    saveInvalidMfaCodeError: 'ACTIVATE'
    reportSuccess: 'done.invoke.activate'
    reportError: 'error.platform.activate'
  }
  internalEvents: {
    'done.invoke.generate': {
      type: 'done.invoke.generate'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.generate': { type: 'error.platform.generate'; data: unknown }
    'error.platform.activate': { type: 'error.platform.activate'; data: unknown }
    'done.invoke.activate': {
      type: 'done.invoke.activate'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'xstate.init': { type: 'xstate.init' }
  }
  invokeSrcNameMap: {
    generate: 'done.invoke.generate'
    activate: 'done.invoke.activate'
  }
  missingImplementations: {
    actions: never
    services: never
    guards: never
    delays: never
  }
  eventsCausingServices: {
    generate: 'GENERATE'
    activate: 'ACTIVATE'
  }
  eventsCausingGuards: {
    invalidMfaType: 'ACTIVATE'
    invalidMfaCode: 'ACTIVATE'
  }
  eventsCausingDelays: {}
  matchesStates:
    | 'idle'
    | 'idle.initial'
    | 'idle.error'
    | 'generating'
    | 'generated'
    | 'generated.idle'
    | 'generated.idle.idle'
    | 'generated.idle.error'
    | 'generated.activating'
    | 'generated.activated'
    | {
        idle?: 'initial' | 'error'
        generated?: 'idle' | 'activating' | 'activated' | { idle?: 'idle' | 'error' }
      }
  tags: never
}
