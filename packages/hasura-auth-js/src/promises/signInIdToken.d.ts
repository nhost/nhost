import { AuthInterpreter } from '../machines';
import { Provider } from '../types';
import { AuthActionLoadingState, SessionActionHandlerResult } from './types';
export interface SignInIdTokenHandlerParams {
    provider: Provider;
    idToken: string;
    nonce?: string;
}
export interface SignInIdTokenHandlerResult extends SessionActionHandlerResult {
}
export interface SignInIdTokenState extends SignInIdTokenHandlerResult, AuthActionLoadingState {
}
export declare const signInIdTokenPromise: (interpreter: AuthInterpreter, { provider, idToken, nonce }: SignInIdTokenHandlerParams) => Promise<SignInIdTokenHandlerResult>;
//# sourceMappingURL=signInIdToken.d.ts.map