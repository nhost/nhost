import { AuthInterpreter } from '../machines';
import { AuthActionLoadingState, SessionActionHandlerResult } from './types';
export interface SignInSmsPasswordlessOtpHandlerResult extends SessionActionHandlerResult {
}
export interface SignInSmsPasswordlessOtpState extends SignInSmsPasswordlessOtpHandlerResult, AuthActionLoadingState {
}
export declare const signInSmsPasswordlessOtpPromise: (interpreter: AuthInterpreter, phoneNumber: string, otp: string) => Promise<SignInSmsPasswordlessOtpHandlerResult>;
//# sourceMappingURL=signInSmsPasswordlessOtp.d.ts.map