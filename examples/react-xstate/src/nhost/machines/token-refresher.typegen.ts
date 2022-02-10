// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    save: 'LOAD_TOKEN' | 'done.invoke.refreshToken'
    persist: 'LOAD_TOKEN' | 'done.invoke.refreshToken'
    reset: 'SIGNOUT' | 'done.invoke.refreshToken' | 'error.platform.refreshToken'
    tick: 'xstate.after(1000)#token.running.pending'
    emit: 'done.invoke.refreshToken'
    retry: 'error.platform.refreshToken'
    sendError: 'error.platform.refreshToken'
    resetTokenRefresherError: 'xstate.init'
  }
  internalEvents: {
    'done.invoke.refreshToken': {
      type: 'done.invoke.refreshToken'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.refreshToken': { type: 'error.platform.refreshToken'; data: unknown }
    'xstate.after(1000)#token.running.pending': { type: 'xstate.after(1000)#token.running.pending' }
    '': { type: '' }
    'xstate.init': { type: 'xstate.init' }
  }
  invokeSrcNameMap: {
    refreshToken: 'done.invoke.refreshToken'
  }
  missingImplementations: {
    actions: 'resetTokenRefresherError'
    services: never
    guards: never
    delays: never
  }
  eventsCausingServices: {
    refreshToken: ''
  }
  eventsCausingGuards: {
    noToken: ''
    token: ''
    shouldRefresh: ''
    canRetry: 'error.platform.refreshToken'
  }
  eventsCausingDelays: {}
  matchesStates:
    | 'stopped'
    | 'idle'
    | 'running'
    | 'running.pending'
    | 'running.refreshing'
    | 'failed'
    | { running?: 'pending' | 'refreshing' }
  tags: never
}
