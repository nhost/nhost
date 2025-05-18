import { AuthInterpreter } from '../machines';
import { EmailOTPOptions } from '../types';
import { AuthActionErrorState, AuthActionLoadingState, AuthActionSuccessState, SessionActionHandlerResult } from './types';
export interface SignInEmailOTPHandlerResult extends AuthActionErrorState, AuthActionSuccessState {
    /**
     * Returns true when the one-time password has been sent via email, and the user needs to send it back to complete sign-in.
     */
    needsOtp: boolean;
}
export interface SignInEmailOTPState extends SignInEmailOTPHandlerResult, AuthActionLoadingState {
}
export interface VerifyEmailOTPHandlerResult extends SessionActionHandlerResult {
}
export declare const signInEmailOTPPromise: (interpreter: AuthInterpreter, email: string, options?: EmailOTPOptions) => Promise<SignInEmailOTPHandlerResult>;
export declare const verifyEmailOTPPromise: (interpreter: AuthInterpreter, email: string, otp: string) => Promise<VerifyEmailOTPHandlerResult>;
//# sourceMappingURL=signInEmailOTP.d.ts.map