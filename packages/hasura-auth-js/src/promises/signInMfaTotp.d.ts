import { AuthInterpreter } from '../machines';
import { AuthActionLoadingState, SessionActionHandlerResult } from './types';
export interface SignInMfaTotpHandlerResult extends SessionActionHandlerResult {
}
export interface SignInMfaTotpState extends SignInMfaTotpHandlerResult, AuthActionLoadingState {
}
export declare const signInMfaTotpPromise: (interpreter: AuthInterpreter, otp: string, ticket?: string) => Promise<SignInMfaTotpHandlerResult>;
//# sourceMappingURL=signInMfaTotp.d.ts.map