import { AuthClient } from '../internal-client';
import { AuthErrorPayload, ChangeEmailOptions, ChangeEmailResponse } from '../types';
export type ChangeEmailContext = {
    error: AuthErrorPayload | null;
};
export type ChangeEmailEvents = {
    type: 'REQUEST';
    email?: string;
    options?: ChangeEmailOptions;
} | {
    type: 'SUCCESS';
} | {
    type: 'ERROR';
    error: AuthErrorPayload | null;
};
export type ChangeEmailServices = {
    request: {
        data: ChangeEmailResponse;
    };
};
export type ChangeEmailMachine = ReturnType<typeof createChangeEmailMachine>;
export declare const createChangeEmailMachine: ({ backendUrl, clientUrl, interpreter }: AuthClient) => import("xstate").StateMachine<ChangeEmailContext, any, {
    type: "REQUEST";
    email?: string;
    options?: ChangeEmailOptions;
} | {
    type: "SUCCESS";
} | {
    type: "ERROR";
    error: AuthErrorPayload | null;
}, {
    value: any;
    context: ChangeEmailContext;
}, import("xstate").BaseActionObject, ChangeEmailServices, import("xstate").ResolveTypegenMeta<import("./change-email.typegen").Typegen0, {
    type: "REQUEST";
    email?: string;
    options?: ChangeEmailOptions;
} | {
    type: "SUCCESS";
} | {
    type: "ERROR";
    error: AuthErrorPayload | null;
}, import("xstate").BaseActionObject, ChangeEmailServices>>;
//# sourceMappingURL=change-email.d.ts.map