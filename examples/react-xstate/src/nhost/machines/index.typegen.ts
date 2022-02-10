// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  '@@xstate/typegen': true
  eventsCausingActions: {
    forwardToRefresher: 'LOAD_TOKEN'
    saveSession:
      | 'SESSION_UPDATE'
      | 'done.invoke.authenticateUserWithPassword'
      | 'done.invoke.registerUser'
      | 'done.invoke.signingOut'
      | 'error.platform.signingOut'
    emitToken: 'done.invoke.authenticateUserWithPassword'
    requestEmailChange: 'CHANGE_EMAIL'
    requestPasswordChange: 'CHANGE_PASSWORD'
    resetAuthenticationError: 'xstate.init'
    saveAuthenticationError:
      | 'error.platform.authenticatePasswordlessEmail'
      | 'error.platform.authenticateUserWithPassword'
      | 'error.platform.registerUser'
    saveInvalidPassword: 'SIGNIN_PASSWORD' | 'REGISTER'
    saveInvalidEmail: 'SIGNIN_PASSWORD' | 'SIGNIN_PASSWORDLESS_EMAIL' | 'REGISTER'
    emitLogout: 'xstate.init'
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
    'done.invoke.registerUser': {
      type: 'done.invoke.registerUser'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'done.invoke.signingOut': {
      type: 'done.invoke.signingOut'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
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
    'error.platform.registerUser': { type: 'error.platform.registerUser'; data: unknown }
    '': { type: '' }
    'xstate.init': { type: 'xstate.init' }
    'done.invoke.tokenRefresher': {
      type: 'done.invoke.tokenRefresher'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
    'error.platform.tokenRefresher': { type: 'error.platform.tokenRefresher'; data: unknown }
    'done.invoke.authenticatePasswordlessEmail': {
      type: 'done.invoke.authenticatePasswordlessEmail'
      data: unknown
      __tip: 'See the XState TS docs to learn how to strongly type this.'
    }
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
    tokenRefresher: 'done.invoke.tokenRefresher'
    signInPasswordlessEmail: 'done.invoke.authenticatePasswordlessEmail'
    signInPassword: 'done.invoke.authenticateUserWithPassword'
    registerUser: 'done.invoke.registerUser'
    signout: 'done.invoke.signingOut'
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
    tokenRefresher: 'xstate.init'
    signInPassword: 'SIGNIN_PASSWORD'
    signInPasswordlessEmail: 'SIGNIN_PASSWORDLESS_EMAIL'
    registerUser: 'REGISTER'
    signout: 'SIGNOUT'
    changePasswordMachine: 'xstate.init'
    changeEmailMachine: 'xstate.init'
  }
  eventsCausingGuards: {
    hasUser: 'SESSION_UPDATE' | 'done.invoke.registerUser'
    invalidEmail: 'SIGNIN_PASSWORD' | 'SIGNIN_PASSWORDLESS_EMAIL' | 'REGISTER'
    invalidPassword: 'SIGNIN_PASSWORD' | 'REGISTER'
    isUserSet: ''
    unverified: 'error.platform.authenticateUserWithPassword' | 'error.platform.registerUser'
  }
  eventsCausingDelays: {}
  matchesStates:
    | 'authentication'
    | 'authentication.signedOut'
    | 'authentication.signedOut.noErrors'
    | 'authentication.signedOut.needsVerification'
    | 'authentication.signedOut.failed'
    | 'authentication.signedOut.failed.server'
    | 'authentication.signedOut.failed.validation'
    | 'authentication.signedOut.failed.validation.password'
    | 'authentication.signedOut.failed.validation.email'
    | 'authentication.authenticating'
    | 'authentication.authenticating.passwordlessEmail'
    | 'authentication.authenticating.password'
    | 'authentication.registering'
    | 'authentication.signingOut'
    | 'authentication.signedIn'
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
          | 'signedOut'
          | 'authenticating'
          | 'registering'
          | 'signingOut'
          | 'signedIn'
          | {
              signedOut?:
                | 'noErrors'
                | 'needsVerification'
                | 'failed'
                | { failed?: 'server' | 'validation' | { validation?: 'password' | 'email' } }
              authenticating?: 'passwordlessEmail' | 'password'
              signedIn?:
                | 'changeEmail'
                | 'changePassword'
                | {
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
