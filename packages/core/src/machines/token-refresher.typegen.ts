// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    save: 'SESSION_LOAD' | 'done.invoke.refreshToken'
    persist: 'SESSION_LOAD' | 'done.invoke.refreshToken'
    resetTimer: 'done.invoke.refreshToken' | 'SIGNOUT' | 'error.platform.refreshToken'
    emit: 'done.invoke.refreshToken'
    sendError: 'error.platform.refreshToken'
    resetToken: 'SIGNOUT' | 'error.platform.refreshToken'
    tick: 'xstate.after(1000)#token.timer.running.pending'
    retry: 'error.platform.refreshToken'
    resetTokenRefresherError: 'xstate.init'
  }
  internalEvents: {
    'done.invoke.refreshToken': {
      type: 'done.invoke.refreshToken'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.refreshToken': { type: 'error.platform.refreshToken'; data: unknown }
    'xstate.after(1000)#token.timer.running.pending': {
      type: 'xstate.after(1000)#token.timer.running.pending'
    }
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
    refreshToken: 'TRY_TOKEN' | ''
  }
  eventsCausingGuards: {
    noToken: ''
    isTimerDisabled: ''
    token: ''
    shouldRefresh: ''
    canRetry: 'error.platform.refreshToken'
  }
  eventsCausingDelays: {}
  matchesStates:
    | 'refesher'
    | 'refesher.idle'
    | 'refesher.idle.noError'
    | 'refesher.idle.error'
    | 'refesher.running'
    | 'timer'
    | 'timer.disabled'
    | 'timer.stopped'
    | 'timer.idle'
    | 'timer.running'
    | 'timer.running.pending'
    | 'timer.running.refreshing'
    | 'timer.failed'
    | {
        refesher?: 'idle' | 'running' | { idle?: 'noError' | 'error' }
        timer?:
          | 'disabled'
          | 'stopped'
          | 'idle'
          | 'running'
          | 'failed'
          | { running?: 'pending' | 'refreshing' }
      }
  tags: never
}
