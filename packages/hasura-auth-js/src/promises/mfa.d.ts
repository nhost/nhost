import { InterpreterFrom } from 'xstate';
import { EnableMfadMachine } from '../machines';
import { AuthActionErrorState } from './types';
export interface GenerateQrCodeHandlerResult extends AuthActionErrorState {
    qrCodeDataUrl: string;
    isGenerated: boolean;
}
export interface GenerateQrCodeState extends GenerateQrCodeHandlerResult {
    isGenerating: boolean;
}
export interface ActivateMfaHandlerResult extends AuthActionErrorState {
    isActivated: boolean;
}
export interface ActivateMfaState extends ActivateMfaHandlerResult {
    isActivating: boolean;
}
export declare const generateQrCodePromise: (service: InterpreterFrom<EnableMfadMachine>) => Promise<GenerateQrCodeHandlerResult>;
export declare const activateMfaPromise: (service: InterpreterFrom<EnableMfadMachine>, code: string) => Promise<ActivateMfaHandlerResult>;
//# sourceMappingURL=mfa.d.ts.map