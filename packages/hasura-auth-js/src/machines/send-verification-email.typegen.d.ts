export interface Typegen0 {
    '@@xstate/typegen': true;
    internalEvents: {
        'done.invoke.request': {
            type: 'done.invoke.request';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'error.platform.request': {
            type: 'error.platform.request';
            data: unknown;
        };
        'xstate.init': {
            type: 'xstate.init';
        };
    };
    invokeSrcNameMap: {
        request: 'done.invoke.request';
    };
    missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        services: never;
    };
    eventsCausingActions: {
        reportError: 'error.platform.request';
        reportSuccess: 'done.invoke.request';
        saveInvalidEmailError: 'REQUEST';
        saveRequestError: 'error.platform.request';
    };
    eventsCausingDelays: {};
    eventsCausingGuards: {
        invalidEmail: 'REQUEST';
    };
    eventsCausingServices: {
        request: 'REQUEST';
    };
    matchesStates: 'idle' | 'idle.error' | 'idle.initial' | 'idle.success' | 'requesting' | {
        idle?: 'error' | 'initial' | 'success';
    };
    tags: never;
}
//# sourceMappingURL=send-verification-email.typegen.d.ts.map