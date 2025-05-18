import { AuthInterpreter } from '../machines';
import { PasswordlessOptions } from '../types';
import { AuthActionErrorState, AuthActionLoadingState, AuthActionSuccessState } from './types';
export interface SignInEmailPasswordlessHandlerResult extends AuthActionErrorState, AuthActionSuccessState {
}
export interface SignInEmailPasswordlessState extends SignInEmailPasswordlessHandlerResult, AuthActionLoadingState {
}
export declare const signInEmailPasswordlessPromise: (interpreter: AuthInterpreter, email: string, options?: PasswordlessOptions) => Promise<SignInEmailPasswordlessHandlerResult>;
//# sourceMappingURL=signInEmailPasswordless.d.ts.map