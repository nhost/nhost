import { InterpreterFrom } from 'xstate';
import { SendVerificationEmailMachine } from '../machines';
import { SendVerificationEmailOptions } from '../types';
import { AuthActionErrorState, AuthActionLoadingState } from './types';
export interface SendVerificationEmailHandlerResult extends AuthActionErrorState {
    /** Returns `true` when a new verification email has been sent */
    isSent: boolean;
}
export interface SendVerificationEmailState extends AuthActionLoadingState, SendVerificationEmailHandlerResult {
}
export declare const sendVerificationEmailPromise: (interpreter: InterpreterFrom<SendVerificationEmailMachine>, email: string, options?: SendVerificationEmailOptions) => Promise<SendVerificationEmailHandlerResult>;
//# sourceMappingURL=sendVerificationEmail.d.ts.map