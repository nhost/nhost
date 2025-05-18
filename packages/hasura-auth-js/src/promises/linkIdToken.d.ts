import { AuthClient } from '../internal-client';
import { Provider } from '../types';
import { AuthActionErrorState, AuthActionSuccessState } from './types';
export interface LinkIdTokenHandlerParams {
    provider: Provider;
    idToken: string;
    nonce?: string;
}
export interface LinkIdTokenHandlerResult extends AuthActionErrorState, AuthActionSuccessState {
}
export declare const linkIdTokenPromise: ({ backendUrl, interpreter }: AuthClient, { provider, idToken, nonce }: LinkIdTokenHandlerParams) => Promise<LinkIdTokenHandlerResult>;
//# sourceMappingURL=linkIdToken.d.ts.map