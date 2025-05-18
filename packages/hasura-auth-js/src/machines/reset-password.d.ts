import { AuthClient } from '../internal-client';
import { AuthErrorPayload, ResetPasswordOptions, ResetPasswordResponse } from '../types';
export type ResetPasswordContext = {
    error: AuthErrorPayload | null;
};
export type ResetPasswordEvents = {
    type: 'REQUEST';
    email?: string;
    options?: ResetPasswordOptions;
} | {
    type: 'SUCCESS';
} | {
    type: 'ERROR';
    error: AuthErrorPayload | null;
};
export type ResetPasswordServices = {
    requestChange: {
        data: ResetPasswordResponse;
    };
};
export type ResetPasswordMachine = ReturnType<typeof createResetPasswordMachine>;
export declare const createResetPasswordMachine: ({ backendUrl, clientUrl }: AuthClient) => import("xstate").StateMachine<ResetPasswordContext, any, {
    type: "REQUEST";
    email?: string;
    options?: ResetPasswordOptions;
} | {
    type: "SUCCESS";
} | {
    type: "ERROR";
    error: AuthErrorPayload | null;
}, {
    value: any;
    context: ResetPasswordContext;
}, import("xstate").BaseActionObject, ResetPasswordServices, import("xstate").ResolveTypegenMeta<import("./reset-password.typegen").Typegen0, {
    type: "REQUEST";
    email?: string;
    options?: ResetPasswordOptions;
} | {
    type: "SUCCESS";
} | {
    type: "ERROR";
    error: AuthErrorPayload | null;
}, import("xstate").BaseActionObject, ResetPasswordServices>>;
//# sourceMappingURL=reset-password.d.ts.map