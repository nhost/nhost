import { AuthInterpreter } from '../machines';
import { AuthActionErrorState, AuthActionLoadingState, AuthActionSuccessState } from './types';
export interface SignOutlessHandlerResult extends AuthActionErrorState, AuthActionSuccessState {
}
export interface SignOutlessState extends SignOutlessHandlerResult, AuthActionLoadingState {
}
export declare const signOutPromise: (interpreter: AuthInterpreter, all?: boolean) => Promise<SignOutlessHandlerResult>;
//# sourceMappingURL=signOut.d.ts.map