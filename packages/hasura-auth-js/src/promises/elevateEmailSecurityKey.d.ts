import { AuthActionErrorState, AuthActionSuccessState, AuthClient } from '..';
export interface ElevateWithSecurityKeyHandlerResult extends AuthActionSuccessState, AuthActionErrorState {
    elevated: boolean;
}
export declare function elevateEmailSecurityKeyPromise(authClient: AuthClient, email: string): Promise<ElevateWithSecurityKeyHandlerResult>;
//# sourceMappingURL=elevateEmailSecurityKey.d.ts.map