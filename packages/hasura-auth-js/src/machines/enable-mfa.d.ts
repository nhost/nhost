import { AuthClient } from '../internal-client';
import { AuthErrorPayload } from '../types';
export type EnableMfaContext = {
    error: AuthErrorPayload | null;
    imageUrl: string | null;
    secret: string | null;
};
export type EnableMfaEvents = {
    type: 'GENERATE';
} | {
    type: 'ACTIVATE';
    code?: string;
    activeMfaType: 'totp';
} | {
    type: 'GENERATED';
} | {
    type: 'GENERATED_ERROR';
    error: AuthErrorPayload | null;
} | {
    type: 'SUCCESS';
} | {
    type: 'ERROR';
    error: AuthErrorPayload | null;
};
export type EnableMfadMachine = ReturnType<typeof createEnableMfaMachine>;
export declare const createEnableMfaMachine: ({ backendUrl, interpreter }: AuthClient) => import("xstate").StateMachine<EnableMfaContext, any, {
    type: "GENERATE";
} | {
    type: "ACTIVATE";
    code?: string;
    activeMfaType: "totp";
} | {
    type: "GENERATED";
} | {
    type: "GENERATED_ERROR";
    error: AuthErrorPayload | null;
} | {
    type: "SUCCESS";
} | {
    type: "ERROR";
    error: AuthErrorPayload | null;
}, {
    value: any;
    context: EnableMfaContext;
}, import("xstate").BaseActionObject, import("xstate").ServiceMap, import("xstate").ResolveTypegenMeta<import("./enable-mfa.typegen").Typegen0, {
    type: "GENERATE";
} | {
    type: "ACTIVATE";
    code?: string;
    activeMfaType: "totp";
} | {
    type: "GENERATED";
} | {
    type: "GENERATED_ERROR";
    error: AuthErrorPayload | null;
} | {
    type: "SUCCESS";
} | {
    type: "ERROR";
    error: AuthErrorPayload | null;
}, import("xstate").BaseActionObject, import("xstate").ServiceMap>>;
//# sourceMappingURL=enable-mfa.d.ts.map