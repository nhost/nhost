// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    saveSession:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.authenticateUserWithWebAuthn'
      | 'done.invoke.refreshToken'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.signUpEmailPassword'
      | 'done.invoke.passwordlessSmsOtp'
    resetTimer: 'SESSION_UPDATE' | 'done.invoke.refreshToken' | ''
    reportTokenChanged:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.authenticateUserWithWebAuthn'
      | 'done.invoke.refreshToken'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.signUpEmailPassword'
      | 'done.invoke.passwordlessSmsOtp'
    saveAuthenticationError:
      | 'error.platform.importRefreshToken'
      | 'error.platform.signingOut'
      | 'error.platform.authenticateUserWithPassword'
      | 'error.platform.authenticateAnonymously'
      | 'error.platform.signInMfaTotp'
      | 'error.platform.authenticateUserWithWebAuthn'
      | 'error.platform.authenticateWithToken'
    saveMfaTicket: 'done.invoke.authenticateUserWithPassword'
    saveRefreshAttempt: 'error.platform.refreshToken'
    clearContext:
      | 'done.invoke.signUpEmailPassword'
      | 'done.invoke.passwordlessEmail'
      | 'done.invoke.passwordlessSms'
    saveRegistrationError:
      | 'error.platform.signUpEmailPassword'
      | 'error.platform.passwordlessEmail'
      | 'error.platform.passwordlessSms'
      | 'error.platform.passwordlessSmsOtp'
    resetErrors:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.authenticateUserWithWebAuthn'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.signUpEmailPassword'
      | 'done.invoke.passwordlessSmsOtp'
      | 'SIGNUP_EMAIL_PASSWORD'
      | 'PASSWORDLESS_EMAIL'
      | 'PASSWORDLESS_SMS'
      | 'PASSWORDLESS_SMS_OTP'
    reportSignedOut:
      | 'error.platform.importRefreshToken'
      | 'error.platform.authenticateUserWithPassword'
      | 'error.platform.authenticateUserWithWebAuthn'
      | 'done.invoke.signUpEmailPassword'
      | 'done.invoke.passwordlessEmail'
      | 'done.invoke.passwordlessSms'
    destroyRefreshToken: 'xstate.init'
    clearContextExceptRefreshToken: 'SIGNOUT'
    reportSignedIn:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.authenticateUserWithWebAuthn'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.signUpEmailPassword'
      | 'done.invoke.passwordlessSmsOtp'
    cleanUrl:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.authenticateUserWithWebAuthn'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.signUpEmailPassword'
      | 'done.invoke.passwordlessSmsOtp'
    broadcastToken:
      | 'SESSION_UPDATE'
      | 'done.invoke.importRefreshToken'
      | ''
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.authenticateAnonymously'
      | 'done.invoke.signInMfaTotp'
      | 'done.invoke.authenticateUserWithWebAuthn'
      | 'done.invoke.authenticateWithToken'
      | 'done.invoke.signUpEmailPassword'
      | 'done.invoke.passwordlessSmsOtp'
  }
  internalEvents: {
    'done.invoke.importRefreshToken': {
      type: 'done.invoke.importRefreshToken'
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
    'done.invoke.authenticateUserWithWebAuthn': {
      type: 'done.invoke.authenticateUserWithWebAuthn'
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
    'done.invoke.signUpEmailPassword': {
      type: 'done.invoke.signUpEmailPassword'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.passwordlessSmsOtp': {
      type: 'done.invoke.passwordlessSmsOtp'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    '': { type: '' }
    'error.platform.importRefreshToken': {
      type: 'error.platform.importRefreshToken'
      data: unknown
    }
    'error.platform.signingOut': { type: 'error.platform.signingOut'; data: unknown }
    'error.platform.authenticateUserWithPassword': {
      type: 'error.platform.authenticateUserWithPassword'
      data: unknown
    }
    'error.platform.authenticateAnonymously': {
      type: 'error.platform.authenticateAnonymously'
      data: unknown
    }
    'error.platform.signInMfaTotp': { type: 'error.platform.signInMfaTotp'; data: unknown }
    'error.platform.authenticateUserWithWebAuthn': {
      type: 'error.platform.authenticateUserWithWebAuthn'
      data: unknown
    }
    'error.platform.authenticateWithToken': {
      type: 'error.platform.authenticateWithToken'
      data: unknown
    }
    'error.platform.refreshToken': { type: 'error.platform.refreshToken'; data: unknown }
    'done.invoke.passwordlessEmail': {
      type: 'done.invoke.passwordlessEmail'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.passwordlessSms': {
      type: 'done.invoke.passwordlessSms'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.signUpEmailPassword': {
      type: 'error.platform.signUpEmailPassword'
      data: unknown
    }
    'error.platform.passwordlessEmail': { type: 'error.platform.passwordlessEmail'; data: unknown }
    'error.platform.passwordlessSms': { type: 'error.platform.passwordlessSms'; data: unknown }
    'error.platform.passwordlessSmsOtp': {
      type: 'error.platform.passwordlessSmsOtp'
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
  }
  invokeSrcNameMap: {
    importRefreshToken: 'done.invoke.importRefreshToken'
    signout: 'done.invoke.signingOut'
    signInPassword: 'done.invoke.authenticateUserWithPassword'
    signInAnonymous: 'done.invoke.authenticateAnonymously'
    signInMfaTotp: 'done.invoke.signInMfaTotp'
    signInWebAuthn: 'done.invoke.authenticateUserWithWebAuthn'
    refreshToken: 'done.invoke.refreshToken' | 'done.invoke.authenticateWithToken'
    signUpEmailPassword: 'done.invoke.signUpEmailPassword'
    passwordlessEmail: 'done.invoke.passwordlessEmail'
    passwordlessSms: 'done.invoke.passwordlessSms'
    passwordlessSmsOtp: 'done.invoke.passwordlessSmsOtp'
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
    signInAnonymous: 'SIGNIN_ANONYMOUS'
    signInMfaTotp: 'SIGNIN_MFA_TOTP'
    signInWebAuthn: 'SIGNIN_WEBAUTHN'
    signout: 'SIGNOUT'
    refreshToken: '' | 'TRY_TOKEN'
    signUpEmailPassword: 'SIGNUP_EMAIL_PASSWORD'
    passwordlessEmail: 'PASSWORDLESS_EMAIL'
    passwordlessSms: 'PASSWORDLESS_SMS'
    passwordlessSmsOtp: 'PASSWORDLESS_SMS_OTP'
  }
  eventsCausingGuards: {
    hasSession: 'SESSION_UPDATE' | 'done.invoke.signUpEmailPassword'
    isSignedIn: '' | 'error.platform.authenticateWithToken'
    hasMfaTicket: 'done.invoke.authenticateUserWithPassword'
    unverified:
      | 'error.platform.authenticateUserWithPassword'
      | 'error.platform.authenticateUserWithWebAuthn'
      | 'error.platform.signUpEmailPassword'
    noToken: ''
    isAutoRefreshDisabled: ''
    hasRefreshToken: ''
    refreshTimerShouldRefresh: ''
    isAnonymous: 'SIGNED_IN'
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
    | 'authentication.authenticating.password'
    | 'authentication.authenticating.anonymous'
    | 'authentication.authenticating.mfa'
    | 'authentication.authenticating.mfa.totp'
    | 'authentication.authenticating.webauthn'
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
    | 'registration'
    | 'registration.incomplete'
    | 'registration.incomplete.noErrors'
    | 'registration.incomplete.needsEmailVerification'
    | 'registration.incomplete.needsOtp'
    | 'registration.incomplete.failed'
    | 'registration.emailPassword'
    | 'registration.passwordlessEmail'
    | 'registration.passwordlessSms'
    | 'registration.passwordlessSmsOtp'
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
              authenticating?: 'password' | 'anonymous' | 'mfa' | 'webauthn' | { mfa?: 'totp' }
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
        registration?:
          | 'incomplete'
          | 'emailPassword'
          | 'passwordlessEmail'
          | 'passwordlessSms'
          | 'passwordlessSmsOtp'
          | 'complete'
          | { incomplete?: 'noErrors' | 'needsEmailVerification' | 'needsOtp' | 'failed' }
      }
  tags: 'loading'
}
