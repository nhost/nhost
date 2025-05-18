import { AuthClient } from '../internal-client';
import { AuthActionErrorState, AuthActionLoadingState, AuthActionSuccessState } from './types';
export interface CreatePATHandlerParams {
    /**
     * The expiration date of the personal access token.
     */
    expiresAt: Date;
    /**
     * Optional metadata to attach to the personal access token.
     */
    metadata?: Record<string, string | number>;
}
export interface CreatePATHandlerResult extends AuthActionErrorState, AuthActionSuccessState {
    /**
     * The data returned by the backend.
     */
    data?: {
        /**
         * The ID of the personal access token that was created.
         */
        id?: string | null;
        /**
         * The personal access token that was created.
         */
        personalAccessToken?: string | null;
    } | null;
}
export interface CreatePATState extends CreatePATHandlerResult, AuthActionLoadingState {
}
export declare const createPATPromise: ({ backendUrl, interpreter }: AuthClient, { expiresAt, metadata }: CreatePATHandlerParams) => Promise<CreatePATHandlerResult>;
//# sourceMappingURL=createPAT.d.ts.map