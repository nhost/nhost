// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    saveSession:
      | 'SESSION_UPDATE'
      | 'done.invoke.autoSignIn'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.registerUser'
      | 'done.invoke.refreshToken'
      | 'done.invoke.authenticateWithToken'
    persist:
      | 'SESSION_UPDATE'
      | 'done.invoke.autoSignIn'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.registerUser'
      | 'done.invoke.refreshToken'
      | 'done.invoke.authenticateWithToken'
    resetTimer: 'SESSION_UPDATE' | 'done.invoke.refreshToken' | ''
    saveInvalidEmail: 'SIGNIN_PASSWORD'
    saveInvalidPassword: 'SIGNIN_PASSWORD'
    saveInvalidSignUpEmail: 'SIGNUP_EMAIL_PASSWORD'
    saveInvalidSignUpPassword: 'SIGNUP_EMAIL_PASSWORD'
    saveAuthenticationError:
      | 'error.platform.authenticateUserWithPassword'
      | 'error.platform.authenticateAnonymously'
    saveRegisrationError: 'error.platform.registerUser'
    tickRefreshTimer: 'xstate.after(1000)#nhost.authentication.signedIn.refreshTimer.running.pending'
    resetAuthenticationError: 'xstate.init'
    clearContext: 'xstate.init'
    destroyToken: 'SIGNOUT'
    resetSignUpError: 'SIGNUP_EMAIL_PASSWORD'
  }
  internalEvents: {
    'done.invoke.autoSignIn': {
      type: 'done.invoke.autoSignIn'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.authenticateUserWithPassword': {
      type: 'done.invoke.authenticateUserWithPassword'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.authenticateAnonymously': {
      type: 'done.invoke.authenticateAnonymously'
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
    'done.invoke.authenticateWithToken': {
      type: 'done.invoke.authenticateWithToken'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    '': { type: '' }
    'error.platform.authenticateUserWithPassword': {
      type: 'error.platform.authenticateUserWithPassword'
      data: unknown
    }
    'error.platform.authenticateAnonymously': {
      type: 'error.platform.authenticateAnonymously'
      data: unknown
    }
    'error.platform.registerUser': { type: 'error.platform.registerUser'; data: unknown }
    'xstate.after(1000)#nhost.authentication.signedIn.refreshTimer.running.pending': {
      type: 'xstate.after(1000)#nhost.authentication.signedIn.refreshTimer.running.pending'
    }
    'xstate.init': { type: 'xstate.init' }
    'error.platform.autoSignIn': { type: 'error.platform.autoSignIn'; data: unknown }
    'done.invoke.signingOut': {
      type: 'done.invoke.signingOut'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.signingOut': { type: 'error.platform.signingOut'; data: unknown }
    'done.invoke.authenticatePasswordlessEmail': {
      type: 'done.invoke.authenticatePasswordlessEmail'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.authenticatePasswordlessEmail': {
      type: 'error.platform.authenticatePasswordlessEmail'
      data: unknown
    }
    'error.platform.refreshToken': { type: 'error.platform.refreshToken'; data: unknown }
    'error.platform.authenticateWithToken': {
      type: 'error.platform.authenticateWithToken'
      data: unknown
    }
  }
  invokeSrcNameMap: {
    autoSignIn: 'done.invoke.autoSignIn'
    signout: 'done.invoke.signingOut'
    signInPasswordlessEmail: 'done.invoke.authenticatePasswordlessEmail'
    signInPassword: 'done.invoke.authenticateUserWithPassword'
    signInAnonymous: 'done.invoke.authenticateAnonymously'
    registerUser: 'done.invoke.registerUser'
    refreshToken: 'done.invoke.refreshToken' | 'done.invoke.authenticateWithToken'
  }
  missingImplementations: {
    actions: never
    services: never
    guards: never
    delays: never
  }
  eventsCausingServices: {
    refreshToken: 'TRY_TOKEN' | ''
    autoSignIn: 'xstate.init'
    signInPassword: 'SIGNIN_PASSWORD'
    signInPasswordlessEmail: 'SIGNIN_PASSWORDLESS_EMAIL'
    registerUser: 'SIGNUP_EMAIL_PASSWORD'
    signInAnonymous: 'SIGNIN_ANONYMOUS'
    signout: 'SIGNOUT'
  }
  eventsCausingGuards: {
    hasSession: 'SESSION_UPDATE' | 'done.invoke.registerUser'
    isAutoSignInDisabled: ''
    isSignedIn: ''
    hasRefreshTokenWithoutSession: ''
    invalidEmail: 'SIGNIN_PASSWORD' | 'SIGNIN_PASSWORDLESS_EMAIL' | 'SIGNUP_EMAIL_PASSWORD'
    invalidPassword: 'SIGNIN_PASSWORD' | 'SIGNUP_EMAIL_PASSWORD'
    unverified: 'error.platform.authenticateUserWithPassword' | 'error.platform.registerUser'
    noToken: ''
    isAutoRefreshDisabled: ''
    hasRefreshToken: ''
    refreshTimerShouldRefresh: ''
  }
  eventsCausingDelays: {}
  matchesStates:
    | 'authentication'
    | 'authentication.checkAutoSignIn'
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
    | 'authentication.authenticating.anonymous'
    | 'authentication.registering'
    | 'authentication.signedIn'
    | 'authentication.signedIn.refreshTimer'
    | 'authentication.signedIn.refreshTimer.disabled'
    | 'authentication.signedIn.refreshTimer.stopped'
    | 'authentication.signedIn.refreshTimer.idle'
    | 'authentication.signedIn.refreshTimer.running'
    | 'authentication.signedIn.refreshTimer.running.pending'
    | 'authentication.signedIn.refreshTimer.running.refreshing'
    | 'token'
    | 'token.idle'
    | 'token.running'
    | {
        authentication?:
          | 'checkAutoSignIn'
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
              authenticating?: 'passwordlessEmail' | 'password' | 'token' | 'anonymous'
              signedIn?:
                | 'refreshTimer'
                | {
                    refreshTimer?:
                      | 'disabled'
                      | 'stopped'
                      | 'idle'
                      | 'running'
                      | { running?: 'pending' | 'refreshing' }
                  }
            }
        token?: 'idle' | 'running'
      }
  tags: 'ready'
}
