import { AuthInterpreter } from '../machines';
import { AuthActionLoadingState, SessionActionHandlerResult } from './types';
export interface SignInPATHandlerResult extends SessionActionHandlerResult {
}
export interface SignInPATState extends SignInPATHandlerResult, AuthActionLoadingState {
}
export declare const signInPATPromise: (interpreter: AuthInterpreter, pat: string) => Promise<SignInPATHandlerResult>;
//# sourceMappingURL=signInPAT.d.ts.map