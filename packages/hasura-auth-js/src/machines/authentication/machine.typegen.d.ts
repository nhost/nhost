export interface Typegen0 {
    '@@xstate/typegen': true;
    internalEvents: {
        '': {
            type: '';
        };
        'done.invoke.authenticateAnonymously': {
            type: 'done.invoke.authenticateAnonymously';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.authenticateUserWithPassword': {
            type: 'done.invoke.authenticateUserWithPassword';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.authenticateUserWithSecurityKey': {
            type: 'done.invoke.authenticateUserWithSecurityKey';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.authenticateWithIdToken': {
            type: 'done.invoke.authenticateWithIdToken';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.authenticateWithPAT': {
            type: 'done.invoke.authenticateWithPAT';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.authenticateWithToken': {
            type: 'done.invoke.authenticateWithToken';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.importRefreshToken': {
            type: 'done.invoke.importRefreshToken';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.passwordlessEmail': {
            type: 'done.invoke.passwordlessEmail';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.passwordlessSms': {
            type: 'done.invoke.passwordlessSms';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.passwordlessSmsOtp': {
            type: 'done.invoke.passwordlessSmsOtp';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.refreshToken': {
            type: 'done.invoke.refreshToken';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.signInEmailOTP': {
            type: 'done.invoke.signInEmailOTP';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.signInMfaTotp': {
            type: 'done.invoke.signInMfaTotp';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.signUpEmailPassword': {
            type: 'done.invoke.signUpEmailPassword';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.signUpSecurityKey': {
            type: 'done.invoke.signUpSecurityKey';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.signingOut': {
            type: 'done.invoke.signingOut';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'done.invoke.verifyEmailOTP': {
            type: 'done.invoke.verifyEmailOTP';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'error.platform.authenticateAnonymously': {
            type: 'error.platform.authenticateAnonymously';
            data: unknown;
        };
        'error.platform.authenticateUserWithPassword': {
            type: 'error.platform.authenticateUserWithPassword';
            data: unknown;
        };
        'error.platform.authenticateUserWithSecurityKey': {
            type: 'error.platform.authenticateUserWithSecurityKey';
            data: unknown;
        };
        'error.platform.authenticateWithIdToken': {
            type: 'error.platform.authenticateWithIdToken';
            data: unknown;
        };
        'error.platform.authenticateWithPAT': {
            type: 'error.platform.authenticateWithPAT';
            data: unknown;
        };
        'error.platform.authenticateWithToken': {
            type: 'error.platform.authenticateWithToken';
            data: unknown;
        };
        'error.platform.importRefreshToken': {
            type: 'error.platform.importRefreshToken';
            data: unknown;
        };
        'error.platform.passwordlessEmail': {
            type: 'error.platform.passwordlessEmail';
            data: unknown;
        };
        'error.platform.passwordlessSms': {
            type: 'error.platform.passwordlessSms';
            data: unknown;
        };
        'error.platform.passwordlessSmsOtp': {
            type: 'error.platform.passwordlessSmsOtp';
            data: unknown;
        };
        'error.platform.refreshToken': {
            type: 'error.platform.refreshToken';
            data: unknown;
        };
        'error.platform.signInEmailOTP': {
            type: 'error.platform.signInEmailOTP';
            data: unknown;
        };
        'error.platform.signInMfaTotp': {
            type: 'error.platform.signInMfaTotp';
            data: unknown;
        };
        'error.platform.signUpEmailPassword': {
            type: 'error.platform.signUpEmailPassword';
            data: unknown;
        };
        'error.platform.signUpSecurityKey': {
            type: 'error.platform.signUpSecurityKey';
            data: unknown;
        };
        'error.platform.signingOut': {
            type: 'error.platform.signingOut';
            data: unknown;
        };
        'error.platform.verifyEmailOTP': {
            type: 'error.platform.verifyEmailOTP';
            data: unknown;
        };
        'xstate.after(1000)#nhost.authentication.signedIn.refreshTimer.running.pending': {
            type: 'xstate.after(1000)#nhost.authentication.signedIn.refreshTimer.running.pending';
        };
        'xstate.after(RETRY_IMPORT_TOKEN_DELAY)#nhost.authentication.retryTokenImport': {
            type: 'xstate.after(RETRY_IMPORT_TOKEN_DELAY)#nhost.authentication.retryTokenImport';
        };
        'xstate.init': {
            type: 'xstate.init';
        };
        'xstate.stop': {
            type: 'xstate.stop';
        };
    };
    invokeSrcNameMap: {
        importRefreshToken: 'done.invoke.importRefreshToken';
        passwordlessEmail: 'done.invoke.passwordlessEmail';
        passwordlessSms: 'done.invoke.passwordlessSms';
        passwordlessSmsOtp: 'done.invoke.passwordlessSmsOtp';
        refreshToken: 'done.invoke.authenticateWithToken' | 'done.invoke.refreshToken';
        signInAnonymous: 'done.invoke.authenticateAnonymously';
        signInEmailOTP: 'done.invoke.signInEmailOTP';
        signInIdToken: 'done.invoke.authenticateWithIdToken';
        signInMfaTotp: 'done.invoke.signInMfaTotp';
        signInPAT: 'done.invoke.authenticateWithPAT';
        signInPassword: 'done.invoke.authenticateUserWithPassword';
        signInSecurityKey: 'done.invoke.authenticateUserWithSecurityKey';
        signInSecurityKeyEmail: 'done.invoke.authenticateUserWithSecurityKey';
        signUpEmailPassword: 'done.invoke.signUpEmailPassword';
        signUpSecurityKey: 'done.invoke.signUpSecurityKey';
        signout: 'done.invoke.signingOut';
        verifyEmailOTP: 'done.invoke.verifyEmailOTP';
    };
    missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        services: never;
    };
    eventsCausingActions: {
        broadcastToken: '' | 'SESSION_UPDATE' | 'done.invoke.authenticateAnonymously' | 'done.invoke.authenticateUserWithPassword' | 'done.invoke.authenticateUserWithSecurityKey' | 'done.invoke.authenticateWithIdToken' | 'done.invoke.authenticateWithPAT' | 'done.invoke.authenticateWithToken' | 'done.invoke.importRefreshToken' | 'done.invoke.passwordlessSmsOtp' | 'done.invoke.refreshToken' | 'done.invoke.signInMfaTotp' | 'done.invoke.signUpEmailPassword' | 'done.invoke.signUpSecurityKey' | 'done.invoke.verifyEmailOTP';
        cleanUrl: '' | 'SESSION_UPDATE' | 'done.invoke.authenticateAnonymously' | 'done.invoke.authenticateUserWithPassword' | 'done.invoke.authenticateUserWithSecurityKey' | 'done.invoke.authenticateWithIdToken' | 'done.invoke.authenticateWithPAT' | 'done.invoke.authenticateWithToken' | 'done.invoke.importRefreshToken' | 'done.invoke.passwordlessSmsOtp' | 'done.invoke.signInMfaTotp' | 'done.invoke.signUpEmailPassword' | 'done.invoke.signUpSecurityKey' | 'done.invoke.verifyEmailOTP';
        clearContext: 'done.invoke.passwordlessEmail' | 'done.invoke.passwordlessSms' | 'done.invoke.signInEmailOTP' | 'done.invoke.signUpEmailPassword' | 'done.invoke.signUpSecurityKey';
        clearContextExceptTokens: 'SIGNOUT';
        destroyAccessToken: 'SESSION_UPDATE' | 'SIGNIN_ANONYMOUS' | 'SIGNIN_ID_TOKEN' | 'SIGNIN_MFA_TOTP' | 'SIGNIN_PASSWORD' | 'SIGNIN_PAT' | 'SIGNIN_SECURITY_KEY' | 'SIGNIN_SECURITY_KEY_EMAIL' | 'done.invoke.signingOut' | 'error.platform.signingOut' | 'xstate.stop';
        destroyRefreshToken: 'SESSION_UPDATE' | 'SIGNIN_ANONYMOUS' | 'SIGNIN_ID_TOKEN' | 'SIGNIN_MFA_TOTP' | 'SIGNIN_PASSWORD' | 'SIGNIN_PAT' | 'SIGNIN_SECURITY_KEY' | 'SIGNIN_SECURITY_KEY_EMAIL' | 'done.invoke.signingOut' | 'error.platform.signingOut' | 'xstate.stop';
        incrementTokenImportAttempts: 'error.platform.importRefreshToken';
        reportSignedIn: '' | 'SESSION_UPDATE' | 'done.invoke.authenticateAnonymously' | 'done.invoke.authenticateUserWithPassword' | 'done.invoke.authenticateUserWithSecurityKey' | 'done.invoke.authenticateWithIdToken' | 'done.invoke.authenticateWithPAT' | 'done.invoke.authenticateWithToken' | 'done.invoke.importRefreshToken' | 'done.invoke.passwordlessSmsOtp' | 'done.invoke.signInMfaTotp' | 'done.invoke.signUpEmailPassword' | 'done.invoke.signUpSecurityKey' | 'done.invoke.verifyEmailOTP';
        reportSignedOut: 'SIGNOUT' | 'done.invoke.authenticateUserWithPassword' | 'done.invoke.importRefreshToken' | 'done.invoke.passwordlessEmail' | 'done.invoke.passwordlessSms' | 'done.invoke.signInEmailOTP' | 'done.invoke.signUpEmailPassword' | 'done.invoke.signUpSecurityKey' | 'error.platform.authenticateAnonymously' | 'error.platform.authenticateUserWithPassword' | 'error.platform.authenticateUserWithSecurityKey' | 'error.platform.authenticateWithIdToken' | 'error.platform.authenticateWithPAT' | 'error.platform.authenticateWithToken' | 'error.platform.importRefreshToken' | 'error.platform.refreshToken' | 'error.platform.signInMfaTotp';
        reportTokenChanged: 'SESSION_UPDATE' | 'SIGNIN_ANONYMOUS' | 'SIGNIN_ID_TOKEN' | 'SIGNIN_MFA_TOTP' | 'SIGNIN_PASSWORD' | 'SIGNIN_PAT' | 'SIGNIN_SECURITY_KEY' | 'SIGNIN_SECURITY_KEY_EMAIL' | 'done.invoke.authenticateAnonymously' | 'done.invoke.authenticateUserWithPassword' | 'done.invoke.authenticateUserWithSecurityKey' | 'done.invoke.authenticateWithIdToken' | 'done.invoke.authenticateWithPAT' | 'done.invoke.authenticateWithToken' | 'done.invoke.importRefreshToken' | 'done.invoke.passwordlessSmsOtp' | 'done.invoke.refreshToken' | 'done.invoke.signInMfaTotp' | 'done.invoke.signUpEmailPassword' | 'done.invoke.signUpSecurityKey' | 'done.invoke.signingOut' | 'done.invoke.verifyEmailOTP' | 'error.platform.signingOut' | 'xstate.stop';
        resetErrors: '' | 'PASSWORDLESS_EMAIL' | 'PASSWORDLESS_SMS' | 'PASSWORDLESS_SMS_OTP' | 'SESSION_UPDATE' | 'SIGNIN_ANONYMOUS' | 'SIGNIN_EMAIL_OTP' | 'SIGNIN_ID_TOKEN' | 'SIGNIN_MFA_TOTP' | 'SIGNIN_PASSWORD' | 'SIGNIN_PAT' | 'SIGNIN_SECURITY_KEY' | 'SIGNIN_SECURITY_KEY_EMAIL' | 'SIGNUP_EMAIL_PASSWORD' | 'SIGNUP_SECURITY_KEY' | 'VERIFY_EMAIL_OTP' | 'done.invoke.authenticateAnonymously' | 'done.invoke.authenticateUserWithPassword' | 'done.invoke.authenticateUserWithSecurityKey' | 'done.invoke.authenticateWithIdToken' | 'done.invoke.authenticateWithPAT' | 'done.invoke.authenticateWithToken' | 'done.invoke.importRefreshToken' | 'done.invoke.passwordlessSmsOtp' | 'done.invoke.signInMfaTotp' | 'done.invoke.signUpEmailPassword' | 'done.invoke.signUpSecurityKey' | 'done.invoke.verifyEmailOTP';
        resetTimer: '' | 'SESSION_UPDATE' | 'done.invoke.refreshToken';
        saveAuthenticationError: 'error.platform.authenticateAnonymously' | 'error.platform.authenticateUserWithPassword' | 'error.platform.authenticateUserWithSecurityKey' | 'error.platform.authenticateWithIdToken' | 'error.platform.authenticateWithPAT' | 'error.platform.authenticateWithToken' | 'error.platform.importRefreshToken' | 'error.platform.signInMfaTotp' | 'error.platform.signingOut';
        saveMfaTicket: 'done.invoke.authenticateUserWithPassword';
        savePATSession: 'done.invoke.authenticateWithPAT';
        saveRefreshAttempt: 'error.platform.refreshToken';
        saveRegistrationError: 'error.platform.passwordlessEmail' | 'error.platform.passwordlessSms' | 'error.platform.passwordlessSmsOtp' | 'error.platform.signInEmailOTP' | 'error.platform.signUpEmailPassword' | 'error.platform.signUpSecurityKey' | 'error.platform.verifyEmailOTP';
        saveSession: 'SESSION_UPDATE' | 'done.invoke.authenticateAnonymously' | 'done.invoke.authenticateUserWithPassword' | 'done.invoke.authenticateUserWithSecurityKey' | 'done.invoke.authenticateWithIdToken' | 'done.invoke.authenticateWithToken' | 'done.invoke.importRefreshToken' | 'done.invoke.passwordlessSmsOtp' | 'done.invoke.refreshToken' | 'done.invoke.signInMfaTotp' | 'done.invoke.signUpEmailPassword' | 'done.invoke.signUpSecurityKey' | 'done.invoke.verifyEmailOTP';
    };
    eventsCausingDelays: {
        RETRY_IMPORT_TOKEN_DELAY: 'error.platform.importRefreshToken';
    };
    eventsCausingGuards: {
        hasMfaTicket: 'done.invoke.authenticateUserWithPassword';
        hasRefreshToken: '';
        hasSession: 'SESSION_UPDATE' | 'done.invoke.importRefreshToken' | 'done.invoke.signUpEmailPassword' | 'done.invoke.signUpSecurityKey';
        isAnonymous: 'SIGNED_IN';
        isAutoRefreshDisabled: '';
        isRefreshTokenPAT: '';
        isSignedIn: '' | 'error.platform.authenticateWithToken';
        isUnauthorizedError: 'error.platform.refreshToken';
        noToken: '';
        refreshTimerShouldRefresh: '';
        shouldRetryImportToken: 'error.platform.importRefreshToken';
        unverified: 'error.platform.authenticateUserWithPassword' | 'error.platform.authenticateUserWithSecurityKey' | 'error.platform.signUpEmailPassword' | 'error.platform.signUpSecurityKey';
    };
    eventsCausingServices: {
        importRefreshToken: 'done.invoke.authenticateWithToken' | 'done.invoke.passwordlessEmail' | 'done.invoke.passwordlessSms' | 'done.invoke.passwordlessSmsOtp' | 'done.invoke.signInEmailOTP' | 'done.invoke.signUpEmailPassword' | 'done.invoke.signUpSecurityKey' | 'done.invoke.verifyEmailOTP' | 'error.platform.authenticateWithToken' | 'xstate.after(RETRY_IMPORT_TOKEN_DELAY)#nhost.authentication.retryTokenImport' | 'xstate.init';
        passwordlessEmail: 'PASSWORDLESS_EMAIL';
        passwordlessSms: 'PASSWORDLESS_SMS';
        passwordlessSmsOtp: 'PASSWORDLESS_SMS_OTP';
        refreshToken: '' | 'TRY_TOKEN';
        signInAnonymous: 'SIGNIN_ANONYMOUS';
        signInEmailOTP: 'SIGNIN_EMAIL_OTP';
        signInIdToken: 'SIGNIN_ID_TOKEN';
        signInMfaTotp: 'SIGNIN_MFA_TOTP';
        signInPAT: 'SIGNIN_PAT';
        signInPassword: 'SIGNIN_PASSWORD';
        signInSecurityKey: 'SIGNIN_SECURITY_KEY';
        signInSecurityKeyEmail: 'SIGNIN_SECURITY_KEY_EMAIL';
        signUpEmailPassword: 'SIGNUP_EMAIL_PASSWORD';
        signUpSecurityKey: 'SIGNUP_SECURITY_KEY';
        signout: 'SIGNOUT';
        verifyEmailOTP: 'VERIFY_EMAIL_OTP';
    };
    matchesStates: 'authentication' | 'authentication.authenticating' | 'authentication.authenticating.anonymous' | 'authentication.authenticating.idToken' | 'authentication.authenticating.mfa' | 'authentication.authenticating.mfa.totp' | 'authentication.authenticating.password' | 'authentication.authenticating.pat' | 'authentication.authenticating.securityKey' | 'authentication.authenticating.securityKeyEmail' | 'authentication.retryTokenImport' | 'authentication.signedIn' | 'authentication.signedIn.refreshTimer' | 'authentication.signedIn.refreshTimer.disabled' | 'authentication.signedIn.refreshTimer.idle' | 'authentication.signedIn.refreshTimer.running' | 'authentication.signedIn.refreshTimer.running.pending' | 'authentication.signedIn.refreshTimer.running.refreshing' | 'authentication.signedIn.refreshTimer.stopped' | 'authentication.signedOut' | 'authentication.signedOut.failed' | 'authentication.signedOut.needsMfa' | 'authentication.signedOut.needsSmsOtp' | 'authentication.signedOut.noErrors' | 'authentication.signedOut.signingOut' | 'authentication.signedOut.success' | 'authentication.starting' | 'registration' | 'registration.complete' | 'registration.emailPassword' | 'registration.incomplete' | 'registration.incomplete.failed' | 'registration.incomplete.needsEmailVerification' | 'registration.incomplete.needsOtp' | 'registration.incomplete.noErrors' | 'registration.passwordlessEmail' | 'registration.passwordlessSms' | 'registration.passwordlessSmsOtp' | 'registration.securityKey' | 'registration.signInEmailOTP' | 'registration.verifyEmailOTP' | 'token' | 'token.idle' | 'token.idle.error' | 'token.idle.noErrors' | 'token.running' | {
        authentication?: 'authenticating' | 'retryTokenImport' | 'signedIn' | 'signedOut' | 'starting' | {
            authenticating?: 'anonymous' | 'idToken' | 'mfa' | 'password' | 'pat' | 'securityKey' | 'securityKeyEmail' | {
                mfa?: 'totp';
            };
            signedIn?: 'refreshTimer' | {
                refreshTimer?: 'disabled' | 'idle' | 'running' | 'stopped' | {
                    running?: 'pending' | 'refreshing';
                };
            };
            signedOut?: 'failed' | 'needsMfa' | 'needsSmsOtp' | 'noErrors' | 'signingOut' | 'success';
        };
        registration?: 'complete' | 'emailPassword' | 'incomplete' | 'passwordlessEmail' | 'passwordlessSms' | 'passwordlessSmsOtp' | 'securityKey' | 'signInEmailOTP' | 'verifyEmailOTP' | {
            incomplete?: 'failed' | 'needsEmailVerification' | 'needsOtp' | 'noErrors';
        };
        token?: 'idle' | 'running' | {
            idle?: 'error' | 'noErrors';
        };
    };
    tags: 'loading';
}
//# sourceMappingURL=machine.typegen.d.ts.map