// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    saveSession:
      | 'SESSION_UPDATE'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.registerUser'
      | 'done.invoke.refreshToken'
    persist:
      | 'SESSION_UPDATE'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.registerUser'
      | 'done.invoke.refreshToken'
    resetTimer: 'SESSION_UPDATE' | 'done.invoke.refreshToken' | ''
    saveRegisrationError: 'error.platform.registerUser'
    tickRefreshTimer: 'xstate.after(1000)#nhost.authentication.signedIn.refreshTimer.running.pending'
    requestEmailChange: 'CHANGE_EMAIL'
    requestPasswordChange: 'CHANGE_PASSWORD'
    resetAuthenticationError: 'xstate.init'
    saveAuthenticationError:
      | 'error.platform.signingOut'
      | 'error.platform.authenticatePasswordlessEmail'
      | 'error.platform.authenticateUserWithPassword'
      | 'error.platform.registerUser'
    saveInvalidPassword: 'SIGNIN_PASSWORD' | 'REGISTER'
    saveInvalidEmail: 'SIGNIN_PASSWORD' | 'SIGNIN_PASSWORDLESS_EMAIL' | 'REGISTER'
    destroyToken: 'SIGNOUT'
    resetEmailChangeError: 'xstate.init'
    saveEmailChangeError: 'xstate.init'
    resetPasswordChangeError: 'xstate.init'
    savePasswordChangeError: 'xstate.init'
  }
  internalEvents: {
    'done.invoke.authenticateUserWithPassword': {
      type: 'done.invoke.authenticateUserWithPassword'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.authenticateWithToken': {
      type: 'done.invoke.authenticateWithToken'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.registerUser': {
      type: 'done.invoke.registerUser'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.refreshToken': {
      type: 'done.invoke.refreshToken'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    '': { type: '' }
    'error.platform.registerUser': { type: 'error.platform.registerUser'; data: unknown }
    'xstate.after(1000)#nhost.authentication.signedIn.refreshTimer.running.pending': {
      type: 'xstate.after(1000)#nhost.authentication.signedIn.refreshTimer.running.pending'
    }
    'error.platform.signingOut': { type: 'error.platform.signingOut'; data: unknown }
    'error.platform.authenticatePasswordlessEmail': {
      type: 'error.platform.authenticatePasswordlessEmail'
      data: unknown
    }
    'error.platform.authenticateUserWithPassword': {
      type: 'error.platform.authenticateUserWithPassword'
      data: unknown
    }
    'xstate.init': { type: 'xstate.init' }
    'done.invoke.autoLogin': {
      type: 'done.invoke.autoLogin'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.autoLogin': { type: 'error.platform.autoLogin'; data: unknown }
    'done.invoke.signingOut': {
      type: 'done.invoke.signingOut'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.authenticatePasswordlessEmail': {
      type: 'done.invoke.authenticatePasswordlessEmail'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.authenticateWithToken': {
      type: 'error.platform.authenticateWithToken'
      data: unknown
    }
    'error.platform.refreshToken': { type: 'error.platform.refreshToken'; data: unknown }
    'done.invoke.changePasswordMachine': {
      type: 'done.invoke.changePasswordMachine'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.changePasswordMachine': {
      type: 'error.platform.changePasswordMachine'
      data: unknown
    }
    'done.invoke.changeEmailMachine': {
      type: 'done.invoke.changeEmailMachine'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.changeEmailMachine': {
      type: 'error.platform.changeEmailMachine'
      data: unknown
    }
  }
  invokeSrcNameMap: {
    autoLogin: 'done.invoke.autoLogin'
    signout: 'done.invoke.signingOut'
    signInPasswordlessEmail: 'done.invoke.authenticatePasswordlessEmail'
    signInPassword: 'done.invoke.authenticateUserWithPassword'
    refreshToken: 'done.invoke.authenticateWithToken' | 'done.invoke.refreshToken'
    registerUser: 'done.invoke.registerUser'
    changePasswordMachine: 'done.invoke.changePasswordMachine'
    changeEmailMachine: 'done.invoke.changeEmailMachine'
  }
  missingImplementations: {
    actions: never
    services: never
    guards: never
    delays: never
  }
  eventsCausingServices: {
    autoLogin: 'xstate.init'
    refreshToken: 'TRY_TOKEN' | ''
    signInPassword: 'SIGNIN_PASSWORD'
    signInPasswordlessEmail: 'SIGNIN_PASSWORDLESS_EMAIL'
    registerUser: 'REGISTER'
    signout: 'SIGNOUT'
    changePasswordMachine: 'xstate.init'
    changeEmailMachine: 'xstate.init'
  }
  eventsCausingGuards: {
    hasSession: 'SESSION_UPDATE' | 'done.invoke.registerUser'
    isSignedIn: ''
    hasRefreshTokenWithoutSession: ''
    invalidEmail: 'SIGNIN_PASSWORD' | 'SIGNIN_PASSWORDLESS_EMAIL' | 'REGISTER'
    invalidPassword: 'SIGNIN_PASSWORD' | 'REGISTER'
    unverified: 'error.platform.authenticateUserWithPassword' | 'error.platform.registerUser'
    noToken: ''
    isAutoRefreshDisabled: ''
    hasRefreshToken: ''
    refreshTimerShouldRefresh: ''
  }
  eventsCausingDelays: {}
  matchesStates:
    | 'authentication'
    | 'authentication.starting'
    | 'authentication.signedOut'
    | 'authentication.signedOut.noErrors'
    | 'authentication.signedOut.success'
    | 'authentication.signedOut.needsVerification'
    | 'authentication.signedOut.failed'
    | 'authentication.signedOut.failed.server'
    | 'authentication.signedOut.failed.validation'
    | 'authentication.signedOut.failed.validation.password'
    | 'authentication.signedOut.failed.validation.email'
    | 'authentication.signedOut.signingOut'
    | 'authentication.authenticating'
    | 'authentication.authenticating.passwordlessEmail'
    | 'authentication.authenticating.password'
    | 'authentication.authenticating.token'
    | 'authentication.registering'
    | 'authentication.signedIn'
    | 'authentication.signedIn.refreshTimer'
    | 'authentication.signedIn.refreshTimer.disabled'
    | 'authentication.signedIn.refreshTimer.stopped'
    | 'authentication.signedIn.refreshTimer.idle'
    | 'authentication.signedIn.refreshTimer.running'
    | 'authentication.signedIn.refreshTimer.running.pending'
    | 'authentication.signedIn.refreshTimer.running.refreshing'
    | 'authentication.signedIn.changeEmail'
    | 'authentication.signedIn.changeEmail.idle'
    | 'authentication.signedIn.changeEmail.idle.noErrors'
    | 'authentication.signedIn.changeEmail.idle.success'
    | 'authentication.signedIn.changeEmail.idle.needsVerification'
    | 'authentication.signedIn.changeEmail.idle.failed'
    | 'authentication.signedIn.changeEmail.idle.failed.server'
    | 'authentication.signedIn.changeEmail.idle.failed.validation'
    | 'authentication.signedIn.changeEmail.running'
    | 'authentication.signedIn.changePassword'
    | 'authentication.signedIn.changePassword.idle'
    | 'authentication.signedIn.changePassword.idle.noErrors'
    | 'authentication.signedIn.changePassword.idle.success'
    | 'authentication.signedIn.changePassword.idle.failed'
    | 'authentication.signedIn.changePassword.idle.failed.server'
    | 'authentication.signedIn.changePassword.idle.failed.validation'
    | 'authentication.signedIn.changePassword.running'
    | {
        authentication?:
          | 'starting'
          | 'signedOut'
          | 'authenticating'
          | 'registering'
          | 'signedIn'
          | {
              signedOut?:
                | 'noErrors'
                | 'success'
                | 'needsVerification'
                | 'failed'
                | 'signingOut'
                | { failed?: 'server' | 'validation' | { validation?: 'password' | 'email' } }
              authenticating?: 'passwordlessEmail' | 'password' | 'token'
              signedIn?:
                | 'refreshTimer'
                | 'changeEmail'
                | 'changePassword'
                | {
                    refreshTimer?:
                      | 'disabled'
                      | 'stopped'
                      | 'idle'
                      | 'running'
                      | { running?: 'pending' | 'refreshing' }
                    changeEmail?:
                      | 'idle'
                      | 'running'
                      | {
                          idle?:
                            | 'noErrors'
                            | 'success'
                            | 'needsVerification'
                            | 'failed'
                            | { failed?: 'server' | 'validation' }
                        }
                    changePassword?:
                      | 'idle'
                      | 'running'
                      | {
                          idle?:
                            | 'noErrors'
                            | 'success'
                            | 'failed'
                            | { failed?: 'server' | 'validation' }
                        }
                  }
            }
      }
  tags: 'ready'
}
