import { AuthErrorPayload } from './types';
export declare const NETWORK_ERROR_CODE = 0;
export declare const OTHER_ERROR_CODE = 1;
export declare const VALIDATION_ERROR_CODE = 10;
export declare const STATE_ERROR_CODE = 20;
/**
 * @internal
 * Adds a standard error payload to any JS Error, or convert a standard error payload into a JS Error.
 * Allows xstate to use `throw` instead of `Promise.reject` to propagate errors.
 * See https://github.com/statelyai/xstate/issues/3037
 */
export declare class CodifiedError extends Error {
    error: AuthErrorPayload;
    constructor(original: Error | AuthErrorPayload);
}
export type ValidationAuthErrorPayload = AuthErrorPayload & {
    status: typeof VALIDATION_ERROR_CODE;
};
export declare const INVALID_EMAIL_ERROR: ValidationAuthErrorPayload;
export declare const INVALID_MFA_TYPE_ERROR: ValidationAuthErrorPayload;
export declare const INVALID_MFA_CODE_ERROR: ValidationAuthErrorPayload;
export declare const INVALID_PASSWORD_ERROR: ValidationAuthErrorPayload;
export declare const INVALID_PHONE_NUMBER_ERROR: ValidationAuthErrorPayload;
export declare const INVALID_MFA_TICKET_ERROR: ValidationAuthErrorPayload;
export declare const NO_MFA_TICKET_ERROR: ValidationAuthErrorPayload;
export declare const NO_REFRESH_TOKEN: ValidationAuthErrorPayload;
export declare const TOKEN_REFRESHER_RUNNING_ERROR: AuthErrorPayload;
export declare const USER_ALREADY_SIGNED_IN: AuthErrorPayload;
export declare const USER_UNAUTHENTICATED: AuthErrorPayload;
export declare const USER_NOT_ANONYMOUS: AuthErrorPayload;
export declare const EMAIL_NEEDS_VERIFICATION: AuthErrorPayload;
export declare const INVALID_REFRESH_TOKEN: AuthErrorPayload;
export declare const INVALID_SIGN_IN_METHOD: AuthErrorPayload;
//# sourceMappingURL=errors.d.ts.map