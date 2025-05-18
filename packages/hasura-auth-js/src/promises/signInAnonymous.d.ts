import { AuthInterpreter } from '../machines';
import { AuthActionLoadingState, SessionActionHandlerResult } from './types';
export interface SignInAnonymousHandlerResult extends SessionActionHandlerResult {
}
export interface SignInAnonymousState extends SignInAnonymousHandlerResult, AuthActionLoadingState {
}
export declare const signInAnonymousPromise: (interpreter: AuthInterpreter) => Promise<SignInAnonymousHandlerResult>;
//# sourceMappingURL=signInAnonymous.d.ts.map