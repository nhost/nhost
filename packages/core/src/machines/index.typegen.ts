// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    saveSession:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.refreshToken'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.registerUser'
    resetTimer: 'SESSION_UPDATE' | 'done.invoke.refreshToken' | ''
    reportTokenChanged:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.refreshToken'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.registerUser'
    saveAuthenticationError:
      | 'error.platform.importRefreshToken'
      | 'error.platform.signingOut'
      | 'error.platform.authenticatePasswordlessSms'
      | 'error.platform.authenticatePasswordlessSmsOtp'
      | 'error.platform.authenticateUserWithPassword'
      | 'error.platform.authenticateAnonymously'
      | 'error.platform.signInMfaTotp'
      | 'error.platform.authenticateWithToken'
      | 'error.platform.passwordlessEmail'
    saveMfaTicket: 'done.invoke.authenticateUserWithPassword'
    reportAwaitEmailVerification:
      | 'error.platform.authenticateUserWithPassword'
      | 'done.invoke.registerUser'
      | 'error.platform.registerUser'
      | 'done.invoke.passwordlessEmail'
    saveRefreshAttempt: 'error.platform.refreshToken'
    saveRegistrationError: 'error.platform.registerUser'
    resetErrors:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.registerUser'
      | 'SIGNUP_EMAIL_PASSWORD'
    reportSignedOut:
      | 'error.platform.importRefreshToken'
      | 'error.platform.authenticateUserWithPassword'
      | 'SIGNUP_EMAIL_PASSWORD'
      | 'PASSWORDLESS_EMAIL'
      | 'done.invoke.registerUser'
      | 'error.platform.registerUser'
    destroyRefreshToken: 'xstate.init'
    clearContextExceptRefreshToken: 'SIGNOUT'
    reportSignedIn:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.registerUser'
    cleanUrl:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.registerUser'
    broadcastToken:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.registerUser'
  }
  internalEvents: {
    'done.invoke.importRefreshToken': {
      type: 'done.invoke.importRefreshToken'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.authenticatePasswordlessSmsOtp': {
      type: 'done.invoke.authenticatePasswordlessSmsOtp'
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
    'done.invoke.signInMfaTotp': {
      type: 'done.invoke.signInMfaTotp'
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
    'done.invoke.registerUser': {
      type: 'done.invoke.registerUser'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    '': { type: '' }
    'error.platform.importRefreshToken': {
      type: 'error.platform.importRefreshToken'
      data: unknown
    }
    'error.platform.signingOut': { type: 'error.platform.signingOut'; data: unknown }
    'error.platform.authenticatePasswordlessSms': {
      type: 'error.platform.authenticatePasswordlessSms'
      data: unknown
    }
    'error.platform.authenticatePasswordlessSmsOtp': {
      type: 'error.platform.authenticatePasswordlessSmsOtp'
      data: unknown
    }
    'error.platform.authenticateUserWithPassword': {
      type: 'error.platform.authenticateUserWithPassword'
      data: unknown
    }
    'error.platform.authenticateAnonymously': {
      type: 'error.platform.authenticateAnonymously'
      data: unknown
    }
    'error.platform.signInMfaTotp': { type: 'error.platform.signInMfaTotp'; data: unknown }
    'error.platform.authenticateWithToken': {
      type: 'error.platform.authenticateWithToken'
      data: unknown
    }
    'error.platform.passwordlessEmail': { type: 'error.platform.passwordlessEmail'; data: unknown }
    'error.platform.registerUser': { type: 'error.platform.registerUser'; data: unknown }
    'done.invoke.passwordlessEmail': {
      type: 'done.invoke.passwordlessEmail'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.refreshToken': { type: 'error.platform.refreshToken'; data: unknown }
    'xstate.after(1000)#nhost.authentication.signedIn.refreshTimer.running.pending': {
      type: 'xstate.after(1000)#nhost.authentication.signedIn.refreshTimer.running.pending'
    }
    'xstate.init': { type: 'xstate.init' }
    'done.invoke.signingOut': {
      type: 'done.invoke.signingOut'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.authenticatePasswordlessSms': {
      type: 'done.invoke.authenticatePasswordlessSms'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
  }
  invokeSrcNameMap: {
    importRefreshToken: 'done.invoke.importRefreshToken'
    signout: 'done.invoke.signingOut'
    signInPasswordlessSms: 'done.invoke.authenticatePasswordlessSms'
    signInPasswordlessSmsOtp: 'done.invoke.authenticatePasswordlessSmsOtp'
    signInPassword: 'done.invoke.authenticateUserWithPassword'
    signInAnonymous: 'done.invoke.authenticateAnonymously'
    signInMfaTotp: 'done.invoke.signInMfaTotp'
    refreshToken: 'done.invoke.refreshToken' | 'done.invoke.authenticateWithToken'
    registerUser: 'done.invoke.registerUser'
    passwordlessEmail: 'done.invoke.passwordlessEmail'
  }
  missingImplementations: {
    actions: never
    services: never
    guards: never
    delays: never
  }
  eventsCausingServices: {
    importRefreshToken: 'xstate.init'
    signInPassword: 'SIGNIN_PASSWORD'
    signInPasswordlessSms: 'SIGNIN_PASSWORDLESS_SMS'
    signInPasswordlessSmsOtp: 'SIGNIN_PASSWORDLESS_SMS_OTP'
    signInAnonymous: 'SIGNIN_ANONYMOUS'
    signInMfaTotp: 'SIGNIN_MFA_TOTP'
    signout: 'SIGNOUT'
    refreshToken: '' | 'TRY_TOKEN'
    registerUser: 'SIGNUP_EMAIL_PASSWORD'
    passwordlessEmail: 'PASSWORDLESS_EMAIL'
  }
  eventsCausingGuards: {
    hasSession: 'SESSION_UPDATE' | 'done.invoke.registerUser'
    isSignedIn: '' | 'error.platform.authenticateWithToken'
    hasMfaTicket: 'done.invoke.authenticateUserWithPassword'
    unverified: 'error.platform.authenticateUserWithPassword' | 'error.platform.registerUser'
    noToken: ''
    isAutoRefreshDisabled: ''
    hasRefreshToken: ''
    refreshTimerShouldRefresh: ''
    needsVerification: 'SIGNED_IN'
    isNotAnonymous: 'SIGNED_IN'
  }
  eventsCausingDelays: {}
  matchesStates:
    | 'authentication'
    | 'authentication.starting'
    | 'authentication.signedOut'
    | 'authentication.signedOut.noErrors'
    | 'authentication.signedOut.success'
    | 'authentication.signedOut.needsSmsOtp'
    | 'authentication.signedOut.needsMfa'
    | 'authentication.signedOut.failed'
    | 'authentication.signedOut.signingOut'
    | 'authentication.authenticating'
    | 'authentication.authenticating.passwordlessSms'
    | 'authentication.authenticating.passwordlessSmsOtp'
    | 'authentication.authenticating.password'
    | 'authentication.authenticating.anonymous'
    | 'authentication.authenticating.mfa'
    | 'authentication.authenticating.mfa.totp'
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
    | 'token.idle.noErrors'
    | 'token.idle.error'
    | 'token.running'
    | 'email'
    | 'email.unknown'
    | 'email.awaitingVerification'
    | 'email.valid'
    | 'registration'
    | 'registration.incomplete'
    | 'registration.registering'
    | 'registration.passwordlessEmail'
    | 'registration.complete'
    | {
        authentication?:
          | 'starting'
          | 'signedOut'
          | 'authenticating'
          | 'signedIn'
          | {
              signedOut?:
                | 'noErrors'
                | 'success'
                | 'needsSmsOtp'
                | 'needsMfa'
                | 'failed'
                | 'signingOut'
              authenticating?:
                | 'passwordlessSms'
                | 'passwordlessSmsOtp'
                | 'password'
                | 'anonymous'
                | 'mfa'
                | { mfa?: 'totp' }
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
        token?: 'idle' | 'running' | { idle?: 'noErrors' | 'error' }
        email?: 'unknown' | 'awaitingVerification' | 'valid'
        registration?: 'incomplete' | 'registering' | 'passwordlessEmail' | 'complete'
      }
  tags: 'loading'
}
