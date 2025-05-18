import { AuthContext, AuthInterpreter, AuthMachineOptions } from './machines';
import { NhostSession } from './types';
export type NhostClientOptions = AuthMachineOptions & {
    /** @internal create and start xstate interpreter on creation. With React, it is started inside the Nhost provider */
    start?: boolean;
};
/**
 * @internal
 * This is a private API.
 */
export declare class AuthClient {
    readonly backendUrl: string;
    readonly clientUrl: string;
    private _machine;
    private _interpreter?;
    private _started;
    private _channel?;
    private _subscriptionsQueue;
    private _subscriptions;
    constructor({ clientStorageType, autoSignIn, autoRefreshToken, start, backendUrl, clientUrl, broadcastKey, devTools, ...defaultOptions }: NhostClientOptions);
    start({ devTools, initialSession, interpreter }?: {
        interpreter?: AuthInterpreter;
        initialSession?: NhostSession;
        devTools?: boolean;
    }): void;
    get machine(): import("xstate").StateMachine<AuthContext, any, {
        type: "SESSION_UPDATE";
        data: {
            session: NhostSession;
        };
    } | {
        type: "TRY_TOKEN";
        token: string;
    } | {
        type: "SIGNIN_ANONYMOUS";
    } | {
        type: "SIGNIN_PAT";
        pat: string;
    } | {
        type: "SIGNIN_SECURITY_KEY_EMAIL";
        email?: string;
    } | {
        type: "SIGNIN_SECURITY_KEY";
    } | {
        type: "SIGNIN_PASSWORD";
        email?: string;
        password?: string;
    } | {
        type: "PASSWORDLESS_EMAIL";
        email?: string;
        options?: import("./types").PasswordlessOptions;
    } | {
        type: "PASSWORDLESS_SMS";
        phoneNumber?: string;
        options?: import("./types").PasswordlessOptions;
    } | {
        type: "PASSWORDLESS_SMS_OTP";
        phoneNumber?: string;
        otp?: string;
    } | {
        type: "SIGNIN_EMAIL_OTP";
        email: string;
        options?: import("./types").EmailOTPOptions;
    } | {
        type: "VERIFY_EMAIL_OTP";
        email: string;
        otp: string;
    } | {
        type: "SIGNUP_EMAIL_PASSWORD";
        email?: string;
        password?: string;
        options?: import("./types").SignUpOptions;
        requestOptions?: import("./types").RequestOptions;
    } | {
        type: "SIGNUP_SECURITY_KEY";
        email?: string;
        options?: import("./types").SignUpSecurityKeyOptions;
        requestOptions?: import("./types").RequestOptions;
    } | {
        type: "SIGNOUT";
        all?: boolean;
    } | {
        type: "SIGNIN_MFA_TOTP";
        ticket?: string;
        otp?: string;
    } | {
        type: "SIGNED_IN";
    } | {
        type: "SIGNED_OUT";
    } | {
        type: "TOKEN_CHANGED";
    } | {
        type: "AWAIT_EMAIL_VERIFICATION";
    } | {
        type: "SIGNIN_ID_TOKEN";
        provider: string;
        idToken: string;
        nonce?: string;
    }, {
        value: any;
        context: AuthContext;
    }, import("xstate").BaseActionObject, {
        signInPassword: {
            data: import("./types").SignInResponse;
        };
        passwordlessSms: {
            data: import("./types").PasswordlessSmsResponse | import("./types").DeanonymizeResponse;
        };
        passwordlessSmsOtp: {
            data: import("./types").PasswordlessSmsOtpResponse;
        };
        signInEmailOTP: {
            data: import("./types").SignInEmailOTPResponse;
        };
        verifyEmailOTP: {
            data: import("./types").VerifyEmailOTPResponse;
        };
        passwordlessEmail: {
            data: import("./types").PasswordlessEmailResponse | import("./types").DeanonymizeResponse;
        };
        signInAnonymous: {
            data: import("./types").SignInAnonymousResponse;
        };
        signInPAT: {
            data: import("./types").SignInPATResponse;
        };
        signInIdToken: {
            data: import("./types").SignInResponse;
        };
        signInMfaTotp: {
            data: import("./types").SignInMfaTotpResponse;
        };
        signInSecurityKeyEmail: {
            data: import("./types").SignInResponse;
        };
        signInSecurityKey: {
            data: import("./types").SignInResponse;
        };
        refreshToken: {
            data: import("./types").NhostSessionResponse;
        };
        signout: {
            data: import("./types").SignOutResponse;
        };
        signUpEmailPassword: {
            data: import("./types").SignUpResponse;
        };
        signUpSecurityKey: {
            data: import("./types").SignUpResponse;
        };
        importRefreshToken: {
            data: import("./types").NhostSessionResponse;
        };
    }, import("xstate").ResolveTypegenMeta<import("./machines/authentication/machine.typegen").Typegen0, {
        type: "SESSION_UPDATE";
        data: {
            session: NhostSession;
        };
    } | {
        type: "TRY_TOKEN";
        token: string;
    } | {
        type: "SIGNIN_ANONYMOUS";
    } | {
        type: "SIGNIN_PAT";
        pat: string;
    } | {
        type: "SIGNIN_SECURITY_KEY_EMAIL";
        email?: string;
    } | {
        type: "SIGNIN_SECURITY_KEY";
    } | {
        type: "SIGNIN_PASSWORD";
        email?: string;
        password?: string;
    } | {
        type: "PASSWORDLESS_EMAIL";
        email?: string;
        options?: import("./types").PasswordlessOptions;
    } | {
        type: "PASSWORDLESS_SMS";
        phoneNumber?: string;
        options?: import("./types").PasswordlessOptions;
    } | {
        type: "PASSWORDLESS_SMS_OTP";
        phoneNumber?: string;
        otp?: string;
    } | {
        type: "SIGNIN_EMAIL_OTP";
        email: string;
        options?: import("./types").EmailOTPOptions;
    } | {
        type: "VERIFY_EMAIL_OTP";
        email: string;
        otp: string;
    } | {
        type: "SIGNUP_EMAIL_PASSWORD";
        email?: string;
        password?: string;
        options?: import("./types").SignUpOptions;
        requestOptions?: import("./types").RequestOptions;
    } | {
        type: "SIGNUP_SECURITY_KEY";
        email?: string;
        options?: import("./types").SignUpSecurityKeyOptions;
        requestOptions?: import("./types").RequestOptions;
    } | {
        type: "SIGNOUT";
        all?: boolean;
    } | {
        type: "SIGNIN_MFA_TOTP";
        ticket?: string;
        otp?: string;
    } | {
        type: "SIGNED_IN";
    } | {
        type: "SIGNED_OUT";
    } | {
        type: "TOKEN_CHANGED";
    } | {
        type: "AWAIT_EMAIL_VERIFICATION";
    } | {
        type: "SIGNIN_ID_TOKEN";
        provider: string;
        idToken: string;
        nonce?: string;
    }, import("xstate").BaseActionObject, {
        signInPassword: {
            data: import("./types").SignInResponse;
        };
        passwordlessSms: {
            data: import("./types").PasswordlessSmsResponse | import("./types").DeanonymizeResponse;
        };
        passwordlessSmsOtp: {
            data: import("./types").PasswordlessSmsOtpResponse;
        };
        signInEmailOTP: {
            data: import("./types").SignInEmailOTPResponse;
        };
        verifyEmailOTP: {
            data: import("./types").VerifyEmailOTPResponse;
        };
        passwordlessEmail: {
            data: import("./types").PasswordlessEmailResponse | import("./types").DeanonymizeResponse;
        };
        signInAnonymous: {
            data: import("./types").SignInAnonymousResponse;
        };
        signInPAT: {
            data: import("./types").SignInPATResponse;
        };
        signInIdToken: {
            data: import("./types").SignInResponse;
        };
        signInMfaTotp: {
            data: import("./types").SignInMfaTotpResponse;
        };
        signInSecurityKeyEmail: {
            data: import("./types").SignInResponse;
        };
        signInSecurityKey: {
            data: import("./types").SignInResponse;
        };
        refreshToken: {
            data: import("./types").NhostSessionResponse;
        };
        signout: {
            data: import("./types").SignOutResponse;
        };
        signUpEmailPassword: {
            data: import("./types").SignUpResponse;
        };
        signUpSecurityKey: {
            data: import("./types").SignUpResponse;
        };
        importRefreshToken: {
            data: import("./types").NhostSessionResponse;
        };
    }>>;
    get interpreter(): AuthInterpreter | undefined;
    get started(): boolean;
    subscribe(fn: (client: AuthClient) => () => void): () => void;
}
/** @deprecated Not in use anymore. Use `clientStorageType: 'cookie'` instead */
export declare class AuthCookieClient extends AuthClient {
    constructor({ ...options }: Omit<NhostClientOptions, 'clientStorageGetter' | 'clientStorageSetter' | 'clientStorage' | 'clientStorageType'>);
}
/** @deprecated Alias for {@link AuthCookieClient} */
export declare const AuthClientSSR: typeof AuthCookieClient;
//# sourceMappingURL=internal-client.d.ts.map