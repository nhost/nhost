import { InterpreterFrom } from 'xstate';
import { AuthOptions, DeanonymizeResponse, NhostSession, NhostSessionResponse, PasswordlessEmailResponse, PasswordlessSmsOtpResponse, PasswordlessSmsResponse, SignInAnonymousResponse, SignInEmailOTPResponse, SignInMfaTotpResponse, SignInPATResponse, SignInResponse, SignOutResponse, SignUpResponse, VerifyEmailOTPResponse } from '../../types';
import { AuthContext } from './context';
export interface AuthMachineOptions extends AuthOptions {
    backendUrl: string;
    clientUrl: string;
}
export type AuthMachine = ReturnType<typeof createAuthMachine>;
export type AuthInterpreter = InterpreterFrom<AuthMachine>;
type AuthServices = {
    signInPassword: {
        data: SignInResponse;
    };
    passwordlessSms: {
        data: PasswordlessSmsResponse | DeanonymizeResponse;
    };
    passwordlessSmsOtp: {
        data: PasswordlessSmsOtpResponse;
    };
    signInEmailOTP: {
        data: SignInEmailOTPResponse;
    };
    verifyEmailOTP: {
        data: VerifyEmailOTPResponse;
    };
    passwordlessEmail: {
        data: PasswordlessEmailResponse | DeanonymizeResponse;
    };
    signInAnonymous: {
        data: SignInAnonymousResponse;
    };
    signInPAT: {
        data: SignInPATResponse;
    };
    signInIdToken: {
        data: SignInResponse;
    };
    signInMfaTotp: {
        data: SignInMfaTotpResponse;
    };
    signInSecurityKeyEmail: {
        data: SignInResponse;
    };
    signInSecurityKey: {
        data: SignInResponse;
    };
    refreshToken: {
        data: NhostSessionResponse;
    };
    signout: {
        data: SignOutResponse;
    };
    signUpEmailPassword: {
        data: SignUpResponse;
    };
    signUpSecurityKey: {
        data: SignUpResponse;
    };
    importRefreshToken: {
        data: NhostSessionResponse;
    };
};
export declare const createAuthMachine: ({ backendUrl, clientUrl, broadcastKey, clientStorageType, clientStorage, refreshIntervalTime, autoRefreshToken, autoSignIn }: AuthMachineOptions) => import("xstate").StateMachine<AuthContext, any, {
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
    options?: import("../../types").PasswordlessOptions;
} | {
    type: "PASSWORDLESS_SMS";
    phoneNumber?: string;
    options?: import("../../types").PasswordlessOptions;
} | {
    type: "PASSWORDLESS_SMS_OTP";
    phoneNumber?: string;
    otp?: string;
} | {
    type: "SIGNIN_EMAIL_OTP";
    email: string;
    options?: import("../../types").EmailOTPOptions;
} | {
    type: "VERIFY_EMAIL_OTP";
    email: string;
    otp: string;
} | {
    type: "SIGNUP_EMAIL_PASSWORD";
    email?: string;
    password?: string;
    options?: import("../../types").SignUpOptions;
    requestOptions?: import("../../types").RequestOptions;
} | {
    type: "SIGNUP_SECURITY_KEY";
    email?: string;
    options?: import("../../types").SignUpSecurityKeyOptions;
    requestOptions?: import("../../types").RequestOptions;
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
}, import("xstate").BaseActionObject, AuthServices, import("xstate").ResolveTypegenMeta<import("./machine.typegen").Typegen0, {
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
    options?: import("../../types").PasswordlessOptions;
} | {
    type: "PASSWORDLESS_SMS";
    phoneNumber?: string;
    options?: import("../../types").PasswordlessOptions;
} | {
    type: "PASSWORDLESS_SMS_OTP";
    phoneNumber?: string;
    otp?: string;
} | {
    type: "SIGNIN_EMAIL_OTP";
    email: string;
    options?: import("../../types").EmailOTPOptions;
} | {
    type: "VERIFY_EMAIL_OTP";
    email: string;
    otp: string;
} | {
    type: "SIGNUP_EMAIL_PASSWORD";
    email?: string;
    password?: string;
    options?: import("../../types").SignUpOptions;
    requestOptions?: import("../../types").RequestOptions;
} | {
    type: "SIGNUP_SECURITY_KEY";
    email?: string;
    options?: import("../../types").SignUpSecurityKeyOptions;
    requestOptions?: import("../../types").RequestOptions;
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
}, import("xstate").BaseActionObject, AuthServices>>;
export {};
//# sourceMappingURL=machine.d.ts.map