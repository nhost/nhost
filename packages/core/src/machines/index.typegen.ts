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
      | 'done.invoke.registerUser'
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
      | 'done.invoke.registerUser'
      | 'done.invoke.refreshToken'
      | 'done.invoke.authenticateWithToken'
    saveAuthenticationError:
      | 'error.platform.importRefreshToken'
      | 'error.platform.authenticatePasswordlessEmail'
      | 'error.platform.authenticatePasswordlessSms'
      | 'error.platform.authenticatePasswordlessSmsOtp'
      | 'error.platform.authenticateUserWithPassword'
      | 'error.platform.authenticateAnonymously'
      | 'error.platform.signInMfaTotp'
    saveInvalidEmail: 'SIGNIN_PASSWORD' | 'SIGNIN_PASSWORDLESS_EMAIL'
    saveInvalidPassword: 'SIGNIN_PASSWORD'
    saveInvalidPhoneNumber: 'SIGNIN_PASSWORDLESS_SMS' | 'SIGNIN_PASSWORDLESS_SMS_OTP'
    saveInvalidSignUpEmail: 'SIGNUP_EMAIL_PASSWORD'
    saveInvalidSignUpPassword: 'SIGNUP_EMAIL_PASSWORD'
    saveNoMfaTicketError: 'SIGNIN_MFA_TOTP'
    reportAwaitEmailVerification:
      | 'done.invoke.authenticatePasswordlessEmail'
      | 'error.platform.authenticateUserWithPassword'
      | 'done.invoke.registerUser'
      | 'error.platform.registerUser'
    saveMfaTicket: 'done.invoke.authenticateUserWithPassword'
    saveRegisrationError: 'error.platform.registerUser'
    saveRefreshAttempt: 'error.platform.refreshToken'
    reportSignedOut:
      | 'error.platform.importRefreshToken'
      | 'done.invoke.authenticatePasswordlessEmail'
      | 'error.platform.authenticateUserWithPassword'
      | 'done.invoke.registerUser'
      | 'error.platform.registerUser'
      | 'error.platform.authenticateWithToken'
    resetAuthenticationError: 'xstate.init'
    destroyRefreshToken: 'xstate.init'
    clearContextExceptRefreshToken: 'SIGNOUT'
    resetSignUpError: 'SIGNUP_EMAIL_PASSWORD'
    reportSignedIn:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.registerUser'
      | 'done.invoke.authenticateWithToken'
    cleanUrl:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.registerUser'
      | 'done.invoke.authenticateWithToken'
    broadcastToken:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticatePasswordlessSmsOtp'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.registerUser'
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
    'error.platform.registerUser': { type: 'error.platform.registerUser'; data: unknown }
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
    importRefreshToken: 'xstate.init'
    signInPassword: 'SIGNIN_PASSWORD'
    signInPasswordlessEmail: 'SIGNIN_PASSWORDLESS_EMAIL'
    signInPasswordlessSms: 'SIGNIN_PASSWORDLESS_SMS'
    signInPasswordlessSmsOtp: 'SIGNIN_PASSWORDLESS_SMS_OTP'
    registerUser: 'SIGNUP_EMAIL_PASSWORD'
    signInAnonymous: 'SIGNIN_ANONYMOUS'
    signInMfaTotp: 'SIGNIN_MFA_TOTP'
    signout: 'SIGNOUT'
    refreshToken: '' | 'TRY_TOKEN'
  }
  eventsCausingGuards: {
    hasSession: 'SESSION_UPDATE' | 'done.invoke.registerUser'
    isSignedIn: '' | 'error.platform.authenticateWithToken'
    invalidEmail: 'SIGNIN_PASSWORD' | 'SIGNIN_PASSWORDLESS_EMAIL' | 'SIGNUP_EMAIL_PASSWORD'
    invalidPassword: 'SIGNIN_PASSWORD' | 'SIGNUP_EMAIL_PASSWORD'
    invalidPhoneNumber: 'SIGNIN_PASSWORDLESS_SMS' | 'SIGNIN_PASSWORDLESS_SMS_OTP'
    noMfaTicket: 'SIGNIN_MFA_TOTP'
    hasMfaTicket: 'done.invoke.authenticateUserWithPassword'
    unverified: 'error.platform.authenticateUserWithPassword' | 'error.platform.registerUser'
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
        email?: 'awaitingVerification' | 'valid'
      }
  tags: 'loading'
}
