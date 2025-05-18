import { AuthInterpreter } from '../machines';
import { RequestOptions, SignUpSecurityKeyOptions } from '../types';
import { AuthActionLoadingState, NeedsEmailVerificationState, SessionActionHandlerResult } from './types';
export interface SignUpSecurityKeyHandlerResult extends SessionActionHandlerResult, NeedsEmailVerificationState {
}
export interface SignUpSecurityKeyState extends SignUpSecurityKeyHandlerResult, AuthActionLoadingState {
}
export declare const signUpEmailSecurityKeyPromise: (interpreter: AuthInterpreter, email: string, options?: SignUpSecurityKeyOptions, requestOptions?: RequestOptions) => Promise<SignUpSecurityKeyHandlerResult>;
//# sourceMappingURL=signUpEmailSecurityKey.d.ts.map