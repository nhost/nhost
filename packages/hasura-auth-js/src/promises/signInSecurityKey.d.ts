import { AuthInterpreter } from '../machines';
import { AuthActionLoadingState, NeedsEmailVerificationState, SessionActionHandlerResult } from './types';
export interface SignInSecurityKeyHandlerResult extends SessionActionHandlerResult, NeedsEmailVerificationState {
}
export interface SignInSecurityKeyState extends SignInSecurityKeyHandlerResult, AuthActionLoadingState {
}
export declare const signInSecurityKeyPromise: (interpreter: AuthInterpreter) => Promise<SignInSecurityKeyHandlerResult>;
//# sourceMappingURL=signInSecurityKey.d.ts.map