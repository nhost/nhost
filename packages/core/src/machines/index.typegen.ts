// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    saveSession:
      | 'SESSION_UPDATE'
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.signInToken'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.signUpUser'
      | 'done.invoke.refreshToken'
      | 'done.invoke.authenticateWithToken'
    persist:
      | 'SESSION_UPDATE'
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.signInToken'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.signUpUser'
      | 'done.invoke.refreshToken'
      | 'done.invoke.authenticateWithToken'
    resetTimer: 'SESSION_UPDATE' | 'done.invoke.refreshToken' | ''
    reportTokenChanged:
      | 'SESSION_UPDATE'
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.signInToken'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.signUpUser'
      | 'done.invoke.refreshToken'
      | 'done.invoke.authenticateWithToken'
    saveRefreshToken: 'done.invoke.importRefreshToken'
    saveAuthenticationError:
      | 'error.platform.importRefreshToken'
      | 'error.platform.authenticatePasswordlessEmail'
      | 'error.platform.authenticatePasswordlessSms'
      | 'error.platform.authenticatePasswordlessSmsOtp'
      | 'error.platform.authenticateUserWithPassword'
      | 'error.platform.signInToken'
      | 'error.platform.authenticateAnonymously'
      | 'error.platform.signInMfaTotp'
    saveMfaTicket: 'done.invoke.authenticateUserWithPassword'
    broadcastToken: 'done.invoke.signInToken'
    saveRegisrationError: 'error.platform.signUpUser'
    saveRefreshAttempt: 'error.platform.refreshToken'
    reportSignedOut:
      | 'error.platform.importRefreshToken'
      | ''
      | 'error.platform.authenticateWithToken'
    resetAuthenticationError: 'xstate.init'
    destroyRefreshToken: 'xstate.init'
    clearContextExceptRefreshToken: 'SIGNOUT'
    resetSignUpError: 'SIGNUP_EMAIL_PASSWORD'
    reportSignedIn:
      | 'SESSION_UPDATE'
      | ''
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.signInToken'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.signUpUser'
      | 'done.invoke.authenticateWithToken'
    cleanUrl:
      | 'SESSION_UPDATE'
      | ''
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.signInToken'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.signUpUser'
      | 'done.invoke.authenticateWithToken'
  }
  internalEvents: {
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
    'done.invoke.signInToken': {
      type: 'done.invoke.signInToken'
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
    'done.invoke.signUpUser': {
      type: 'done.invoke.signUpUser'
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
    'done.invoke.importRefreshToken': {
      type: 'done.invoke.importRefreshToken'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.importRefreshToken': {
      type: 'error.platform.importRefreshToken'
      data: unknown
    }
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
    'error.platform.signInToken': { type: 'error.platform.signInToken'; data: unknown }
    'error.platform.authenticateAnonymously': {
      type: 'error.platform.authenticateAnonymously'
      data: unknown
    }
    'error.platform.signInMfaTotp': { type: 'error.platform.signInMfaTotp'; data: unknown }
    'error.platform.signUpUser': { type: 'error.platform.signUpUser'; data: unknown }
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
    'error.platform.signingOut': { type: 'error.platform.signingOut'; data: unknown }
    'done.invoke.authenticatePasswordlessEmail': {
      type: 'done.invoke.authenticatePasswordlessEmail'
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
    refreshToken:
      | 'done.invoke.signInToken'
      | 'done.invoke.refreshToken'
      | 'done.invoke.authenticateWithToken'
    signInAnonymous: 'done.invoke.authenticateAnonymously'
    signInMfaTotp: 'done.invoke.signInMfaTotp'
    signUpUser: 'done.invoke.signUpUser'
  }
  missingImplementations: {
    actions: never
    services: never
    guards: never
    delays: never
  }
  eventsCausingServices: {
    importRefreshToken: 'xstate.init'
    refreshToken: '' | 'TRY_TOKEN'
    signInPassword: 'SIGNIN_PASSWORD'
    signInPasswordlessEmail: 'SIGNIN_PASSWORDLESS_EMAIL'
    signInPasswordlessSms: 'SIGNIN_PASSWORDLESS_SMS'
    signInPasswordlessSmsOtp: 'SIGNIN_PASSWORDLESS_SMS_OTP'
    signUpUser: 'SIGNUP_EMAIL_PASSWORD'
    signInAnonymous: 'SIGNIN_ANONYMOUS'
    signInMfaTotp: 'SIGNIN_MFA_TOTP'
    signout: 'SIGNOUT'
  }
  eventsCausingGuards: {
    hasSession: 'SESSION_UPDATE' | 'done.invoke.signUpUser'
    isSignedIn: '' | 'error.platform.authenticateWithToken'
    hasRefreshTokenWithoutSession: ''
    hasAuthenticationError: ''
    hasMfaTicket: 'done.invoke.authenticateUserWithPassword'
    unverified: 'error.platform.authenticateUserWithPassword' | 'error.platform.signUpUser'
    noToken: ''
    isAutoRefreshDisabled: ''
    hasRefreshToken: ''
    refreshTimerShouldRefresh: ''
  }
  eventsCausingDelays: {}
  matchesStates:
    | 'authentication'
    | 'authentication.importingRefreshToken'
    | 'authentication.starting'
    | 'authentication.signedOut'
    | 'authentication.signedOut.noErrors'
    | 'authentication.signedOut.success'
    | 'authentication.signedOut.needsEmailVerification'
    | 'authentication.signedOut.needsSmsOtp'
    | 'authentication.signedOut.needsMfa'
    | 'authentication.signedOut.failed'
    | 'authentication.signedOut.failed.server'
    | 'authentication.signedOut.failed.validation'
    | 'authentication.signedOut.failed.validation.password'
    | 'authentication.signedOut.failed.validation.email'
    | 'authentication.signedOut.failed.validation.phoneNumber'
    | 'authentication.signedOut.signingOut'
    | 'authentication.authenticating'
    | 'authentication.authenticating.passwordlessEmail'
    | 'authentication.authenticating.passwordlessSms'
    | 'authentication.authenticating.passwordlessSmsOtp'
    | 'authentication.authenticating.password'
    | 'authentication.authenticating.token'
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
    | {
        authentication?:
          | 'importingRefreshToken'
          | 'starting'
          | 'signedOut'
          | 'authenticating'
          | 'registering'
          | 'signedIn'
          | {
              signedOut?:
                | 'noErrors'
                | 'success'
                | 'needsEmailVerification'
                | 'needsSmsOtp'
                | 'needsMfa'
                | 'failed'
                | 'signingOut'
                | {
                    failed?:
                      | 'server'
                      | 'validation'
                      | { validation?: 'password' | 'email' | 'phoneNumber' }
                  }
              authenticating?:
                | 'passwordlessEmail'
                | 'passwordlessSms'
                | 'passwordlessSmsOtp'
                | 'password'
                | 'token'
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
      }
  tags: 'ready'
}
