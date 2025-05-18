import { InterpreterFrom } from 'xstate';
import { ChangePasswordMachine } from '../machines';
import { AuthActionErrorState, AuthActionLoadingState, AuthActionSuccessState } from './types';
export interface ChangePasswordState extends ChangePasswordHandlerResult, AuthActionLoadingState {
}
export interface ChangePasswordHandlerResult extends AuthActionErrorState, AuthActionSuccessState {
}
export declare const changePasswordPromise: (interpreter: InterpreterFrom<ChangePasswordMachine>, password: string, ticket?: string) => Promise<ChangePasswordHandlerResult>;
//# sourceMappingURL=changePassword.d.ts.map