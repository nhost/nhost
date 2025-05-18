import { InterpreterFrom } from 'xstate';
import { ResetPasswordMachine } from '../machines';
import { ResetPasswordOptions } from '../types';
import { AuthActionErrorState, AuthActionLoadingState } from './types';
export interface ResetPasswordHandlerResult extends AuthActionErrorState {
    /** Returns `true` when an email to reset the password has been sent */
    isSent: boolean;
}
export interface ResetPasswordState extends ResetPasswordHandlerResult, AuthActionLoadingState {
}
export declare const resetPasswordPromise: (interpreter: InterpreterFrom<ResetPasswordMachine>, email: string, options?: ResetPasswordOptions) => Promise<ResetPasswordHandlerResult>;
//# sourceMappingURL=resetPassword.d.ts.map