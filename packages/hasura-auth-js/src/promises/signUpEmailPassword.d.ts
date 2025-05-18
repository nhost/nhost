import { AuthInterpreter } from '../machines';
import { RequestOptions, SignUpOptions } from '../types';
import { AuthActionLoadingState, NeedsEmailVerificationState, SessionActionHandlerResult } from './types';
export interface SignUpEmailPasswordHandlerResult extends SessionActionHandlerResult, NeedsEmailVerificationState {
}
export interface SignUpEmailPasswordState extends SignUpEmailPasswordHandlerResult, AuthActionLoadingState {
}
export declare const signUpEmailPasswordPromise: (interpreter: AuthInterpreter, email: string, password: string, options?: SignUpOptions, requestOptions?: RequestOptions) => Promise<SignUpEmailPasswordHandlerResult>;
//# sourceMappingURL=signUpEmailPassword.d.ts.map