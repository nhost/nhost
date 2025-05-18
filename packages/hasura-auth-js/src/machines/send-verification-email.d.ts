import { AuthClient } from '../internal-client';
import { AuthErrorPayload, SendVerificationEmailOptions, SendVerificationEmailResponse } from '../types';
export type SendVerificationEmailContext = {
    error: AuthErrorPayload | null;
};
export type SendVerificationEmailEvents = {
    type: 'REQUEST';
    email?: string;
    options?: SendVerificationEmailOptions;
} | {
    type: 'SUCCESS';
} | {
    type: 'ERROR';
    error: AuthErrorPayload | null;
};
export type SendVerificationEmailServices = {
    request: {
        data: SendVerificationEmailResponse;
    };
};
export type SendVerificationEmailMachine = ReturnType<typeof createSendVerificationEmailMachine>;
export declare const createSendVerificationEmailMachine: ({ backendUrl, clientUrl }: AuthClient) => import("xstate").StateMachine<SendVerificationEmailContext, any, {
    type: "REQUEST";
    email?: string;
    options?: SendVerificationEmailOptions;
} | {
    type: "SUCCESS";
} | {
    type: "ERROR";
    error: AuthErrorPayload | null;
}, {
    value: any;
    context: SendVerificationEmailContext;
}, import("xstate").BaseActionObject, SendVerificationEmailServices, import("xstate").ResolveTypegenMeta<import("./send-verification-email.typegen").Typegen0, {
    type: "REQUEST";
    email?: string;
    options?: SendVerificationEmailOptions;
} | {
    type: "SUCCESS";
} | {
    type: "ERROR";
    error: AuthErrorPayload | null;
}, import("xstate").BaseActionObject, SendVerificationEmailServices>>;
//# sourceMappingURL=send-verification-email.d.ts.map