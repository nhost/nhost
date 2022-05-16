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
      | 'done.invoke.signUp'
      | 'done.invoke.refreshToken'
      | 'done.invoke.authenticateWithToken'
    resetTimer: 'SESSION_UPDATE' | 'done.invoke.refreshToken' | ''
    reportTokenChanged:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.signUp'
      | 'done.invoke.refreshToken'
      | 'done.invoke.authenticateWithToken'
    saveAuthenticationError:
      | 'error.platform.importRefreshToken'
      | 'error.platform.signingOut'
      | 'error.platform.authenticatePasswordlessEmail'
      | 'error.platform.authenticatePasswordlessSms'
      | 'error.platform.authenticatePasswordlessSmsOtp'
      | 'error.platform.authenticateUserWithPassword'
      | 'error.platform.authenticateAnonymously'
      | 'error.platform.signInMfaTotp'
    reportAwaitEmailVerification:
      | 'done.invoke.authenticatePasswordlessEmail'
      | 'error.platform.authenticateUserWithPassword'
      | 'done.invoke.signUp'
      | 'error.platform.signUp'
    saveMfaTicket: 'done.invoke.authenticateUserWithPassword'
    saveRegistrationError: 'error.platform.signUp'
    saveRefreshAttempt: 'error.platform.refreshToken'
    resetErrors:
      | 'SIGNUP_EMAIL_PASSWORD'
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.signUp'
      | 'done.invoke.authenticateWithToken'
    reportSignedOut:
      | 'error.platform.importRefreshToken'
      | 'done.invoke.authenticatePasswordlessEmail'
      | 'error.platform.authenticateUserWithPassword'
      | 'done.invoke.signUp'
      | 'error.platform.signUp'
      | 'error.platform.authenticateWithToken'
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
      | 'done.invoke.signUp'
      | 'done.invoke.authenticateWithToken'
    cleanUrl:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.signUp'
      | 'done.invoke.authenticateWithToken'
    broadcastToken:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.signUp'
      | 'done.invoke.authenticateWithToken'
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
    'done.invoke.signUp': {
      type: 'done.invoke.signUp'
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
    'error.platform.importRefreshToken': {
      type: 'error.platform.importRefreshToken'
      data: unknown
    }
    'error.platform.signingOut': { type: 'error.platform.signingOut'; data: unknown }
    'error.platform.authenticatePasswordlessEmail': {
      type: 'error.platform.authenticatePasswordlessEmail'
      data: unknown
    }
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
    'done.invoke.authenticatePasswordlessEmail': {
      type: 'done.invoke.authenticatePasswordlessEmail'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.signUp': { type: 'error.platform.signUp'; data: unknown }
    'error.platform.refreshToken': { type: 'error.platform.refreshToken'; data: unknown }
    'error.platform.authenticateWithToken': {
      type: 'error.platform.authenticateWithToken'
      data: unknown
    }
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
    signInPasswordlessEmail: 'done.invoke.authenticatePasswordlessEmail'
    signInPasswordlessSms: 'done.invoke.authenticatePasswordlessSms'
    signInPasswordlessSmsOtp: 'done.invoke.authenticatePasswordlessSmsOtp'
    signInPassword: 'done.invoke.authenticateUserWithPassword'
    signInAnonymous: 'done.invoke.authenticateAnonymously'
    signInMfaTotp: 'done.invoke.signInMfaTotp'
    signUp: 'done.invoke.signUp'
    refreshToken: 'done.invoke.refreshToken' | 'done.invoke.authenticateWithToken'
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
    signInPasswordlessEmail: 'SIGNIN_PASSWORDLESS_EMAIL'
    signInPasswordlessSms: 'SIGNIN_PASSWORDLESS_SMS'
    signInPasswordlessSmsOtp: 'SIGNIN_PASSWORDLESS_SMS_OTP'
    signUp: 'SIGNUP_EMAIL_PASSWORD'
    signInAnonymous: 'SIGNIN_ANONYMOUS'
    signInMfaTotp: 'SIGNIN_MFA_TOTP'
    signout: 'SIGNOUT'
    refreshToken: '' | 'TRY_TOKEN'
  }
  eventsCausingGuards: {
    hasSession: 'SESSION_UPDATE' | 'done.invoke.signUp'
    isSignedIn: '' | 'error.platform.authenticateWithToken'
    hasMfaTicket: 'done.invoke.authenticateUserWithPassword'
    unverified: 'error.platform.authenticateUserWithPassword' | 'error.platform.signUp'
    noToken: ''
    isAutoRefreshDisabled: ''
    hasRefreshToken: ''
    refreshTimerShouldRefresh: ''
    needsVerification: 'SIGNED_IN'
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
    | 'authentication.authenticating.passwordlessEmail'
    | 'authentication.authenticating.passwordlessSms'
    | 'authentication.authenticating.passwordlessSmsOtp'
    | 'authentication.authenticating.password'
    | 'authentication.authenticating.anonymous'
    | 'authentication.authenticating.mfa'
    | 'authentication.authenticating.mfa.totp'
    | 'authentication.registering'
    | 'authentication.signedIn'
    | 'authentication.signedIn.refreshTimer'
    | 'authentication.signedIn.refreshTimer.disabled'
    | 'authentication.signedIn.refreshTimer.stopped'
    | 'authentication.signedIn.refreshTimer.idle'
    | 'authentication.signedIn.refreshTimer.running'
    | 'authentication.signedIn.refreshTimer.running.pending'
    | 'authentication.signedIn.refreshTimer.running.refreshing'
    | 'authentication.signedIn.deanonymizing'
    | 'authentication.signedIn.deanonymizing.error'
    | 'authentication.signedIn.deanonymizing.success'
    | 'token'
    | 'token.idle'
    | 'token.idle.noErrors'
    | 'token.idle.error'
    | 'token.running'
    | 'email'
    | 'email.unknown'
    | 'email.awaitingVerification'
    | 'email.valid'
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
                | 'needsSmsOtp'
                | 'needsMfa'
                | 'failed'
                | 'signingOut'
              authenticating?:
                | 'passwordlessEmail'
                | 'passwordlessSms'
                | 'passwordlessSmsOtp'
                | 'password'
                | 'anonymous'
                | 'mfa'
                | { mfa?: 'totp' }
              signedIn?:
                | 'refreshTimer'
                | 'deanonymizing'
                | {
                    refreshTimer?:
                      | 'disabled'
                      | 'stopped'
                      | 'idle'
                      | 'running'
                      | { running?: 'pending' | 'refreshing' }
                    deanonymizing?: 'error' | 'success'
                  }
            }
        token?: 'idle' | 'running' | { idle?: 'noErrors' | 'error' }
        email?: 'unknown' | 'awaitingVerification' | 'valid'
      }
  tags: 'loading'
}
