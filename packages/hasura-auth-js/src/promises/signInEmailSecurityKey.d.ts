import { AuthInterpreter } from '../machines';
import { AuthActionLoadingState, NeedsEmailVerificationState, SessionActionHandlerResult } from './types';
export interface SignInSecurityKeyPasswordlessHandlerResult extends SessionActionHandlerResult, NeedsEmailVerificationState {
}
export interface SignInSecurityKeyPasswordlessState extends SignInSecurityKeyPasswordlessHandlerResult, AuthActionLoadingState {
}
export declare const signInEmailSecurityKeyPromise: (interpreter: AuthInterpreter, email: string) => Promise<SignInSecurityKeyPasswordlessHandlerResult>;
//# sourceMappingURL=signInEmailSecurityKey.d.ts.map