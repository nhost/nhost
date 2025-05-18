import { AuthClient } from '../internal-client';
import { AuthErrorPayload, ChangePasswordResponse } from '../types';
export type ChangePasswordContext = {
    error: AuthErrorPayload | null;
};
export type ChangePasswordEvents = {
    type: 'REQUEST';
    password?: string;
    ticket?: string;
} | {
    type: 'SUCCESS';
} | {
    type: 'ERROR';
    error: AuthErrorPayload | null;
};
export type ChangePasswordServices = {
    requestChange: {
        data: ChangePasswordResponse;
    };
};
export type ChangePasswordMachine = ReturnType<typeof createChangePasswordMachine>;
export declare const createChangePasswordMachine: ({ backendUrl, interpreter }: AuthClient) => import("xstate").StateMachine<ChangePasswordContext, any, {
    type: "REQUEST";
    password?: string;
    ticket?: string;
} | {
    type: "SUCCESS";
} | {
    type: "ERROR";
    error: AuthErrorPayload | null;
}, {
    value: any;
    context: ChangePasswordContext;
}, import("xstate").BaseActionObject, ChangePasswordServices, import("xstate").ResolveTypegenMeta<import("./change-password.typegen").Typegen0, {
    type: "REQUEST";
    password?: string;
    ticket?: string;
} | {
    type: "SUCCESS";
} | {
    type: "ERROR";
    error: AuthErrorPayload | null;
}, import("xstate").BaseActionObject, ChangePasswordServices>>;
//# sourceMappingURL=change-password.d.ts.map