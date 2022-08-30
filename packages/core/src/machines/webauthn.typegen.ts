// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    saveError:
      | 'error.platform.requestChallenge'
      | 'error.platform.startRegistration'
      | 'error.platform.verifyChallenge'
    reportError:
      | 'error.platform.requestChallenge'
      | 'error.platform.startRegistration'
      | 'error.platform.verifyChallenge'
    reportSuccess: 'done.invoke.verifyChallenge'
    clearContext: 'REQUEST'
  }
  internalEvents: {
    'error.platform.requestChallenge': { type: 'error.platform.requestChallenge'; data: unknown }
    'error.platform.startRegistration': { type: 'error.platform.startRegistration'; data: unknown }
    'error.platform.verifyChallenge': { type: 'error.platform.verifyChallenge'; data: unknown }
    'done.invoke.verifyChallenge': {
      type: 'done.invoke.verifyChallenge'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.requestChallenge': {
      type: 'done.invoke.requestChallenge'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.startRegistration': {
      type: 'done.invoke.startRegistration'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'xstate.init': { type: 'xstate.init' }
  }
  invokeSrcNameMap: {
    requestChallenge: 'done.invoke.requestChallenge'
    startRegistration: 'done.invoke.startRegistration'
    verifyChallenge: 'done.invoke.verifyChallenge'
  }
  missingImplementations: {
    actions: never
    services: never
    guards: never
    delays: never
  }
  eventsCausingServices: {
    requestChallenge: 'REQUEST'
    startRegistration: 'done.invoke.requestChallenge'
    verifyChallenge: 'done.invoke.startRegistration'
  }
  eventsCausingGuards: {}
  eventsCausingDelays: {}
  matchesStates:
    | 'idle'
    | 'idle.initial'
    | 'idle.success'
    | 'idle.error'
    | 'requestingChallenge'
    | 'registeringDevice'
    | 'verifyingChallenge'
    | { idle?: 'initial' | 'success' | 'error' }
  tags: never
}
