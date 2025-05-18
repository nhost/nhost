import { AuthClient } from '../internal-client';
import { SecurityKey } from '../types';
import { AuthActionErrorState, AuthActionLoadingState, AuthActionSuccessState } from './types';
export interface AddSecurityKeyHandlerResult extends AuthActionErrorState, AuthActionSuccessState {
    key?: SecurityKey;
}
export interface AddSecurityKeyState extends AddSecurityKeyHandlerResult, AuthActionLoadingState {
}
export declare const addSecurityKeyPromise: ({ backendUrl, interpreter }: AuthClient, nickname?: string) => Promise<AddSecurityKeyHandlerResult>;
//# sourceMappingURL=addSecurityKey.d.ts.map