import { InterpreterFrom } from 'xstate';
import { ChangeEmailMachine } from '../machines';
import { ChangeEmailOptions } from '../types';
import { AuthActionErrorState, AuthActionLoadingState, NeedsEmailVerificationState } from './types';
export interface ChangeEmailHandlerResult extends AuthActionErrorState, NeedsEmailVerificationState {
}
export interface ChangeEmailState extends ChangeEmailHandlerResult, AuthActionLoadingState {
}
export declare const changeEmailPromise: (interpreter: InterpreterFrom<ChangeEmailMachine>, email: string, options?: ChangeEmailOptions) => Promise<ChangeEmailHandlerResult>;
//# sourceMappingURL=changeEmail.d.ts.map