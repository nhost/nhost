import { AuthInterpreter } from '../machines';
import { PasswordlessOptions } from '../types';
import { AuthActionErrorState, AuthActionLoadingState, AuthActionSuccessState } from './types';
export interface SignInSmsPasswordlessState extends SignInSmsPasswordlessHandlerResult, AuthActionLoadingState {
}
export interface SignInSmsPasswordlessHandlerResult extends AuthActionErrorState, AuthActionSuccessState {
    /**
     * Returns true when the one-time password has been sent over by SMS, and the user needs to send it back to complete sign-in.
     */
    needsOtp: boolean;
}
export declare const signInSmsPasswordlessPromise: (interpreter: AuthInterpreter, phoneNumber: string, options?: PasswordlessOptions) => Promise<SignInSmsPasswordlessHandlerResult>;
//# sourceMappingURL=signInSmsPasswordless.d.ts.map