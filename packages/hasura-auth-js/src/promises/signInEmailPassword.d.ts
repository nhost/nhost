import { AuthInterpreter } from '../machines';
import { AuthActionLoadingState, NeedsEmailVerificationState, SessionActionHandlerResult } from './types';
export interface SignInEmailPasswordHandlerResult extends SessionActionHandlerResult, NeedsEmailVerificationState {
    needsMfaOtp: boolean;
    mfa: {
        ticket: string;
    } | null;
}
export interface SignInEmailPasswordState extends SignInEmailPasswordHandlerResult, AuthActionLoadingState {
}
export declare const signInEmailPasswordPromise: (interpreter: AuthInterpreter, email: string, password: string) => Promise<SignInEmailPasswordHandlerResult>;
//# sourceMappingURL=signInEmailPassword.d.ts.map