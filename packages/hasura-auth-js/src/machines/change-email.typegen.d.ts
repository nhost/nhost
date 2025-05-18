export interface Typegen0 {
    '@@xstate/typegen': true;
    internalEvents: {
        'done.invoke.requestChange': {
            type: 'done.invoke.requestChange';
            data: unknown;
            __tip: 'See the XState TS docs to learn how to strongly type this.';
        };
        'error.platform.requestChange': {
            type: 'error.platform.requestChange';
            data: unknown;
        };
        'xstate.init': {
            type: 'xstate.init';
        };
    };
    invokeSrcNameMap: {
        requestChange: 'done.invoke.requestChange';
    };
    missingImplementations: {
        actions: never;
        delays: never;
        guards: never;
        services: never;
    };
    eventsCausingActions: {
        reportError: 'error.platform.requestChange';
        reportSuccess: 'done.invoke.requestChange';
        saveInvalidEmailError: 'REQUEST';
        saveRequestError: 'error.platform.requestChange';
    };
    eventsCausingDelays: {};
    eventsCausingGuards: {
        invalidEmail: 'REQUEST';
    };
    eventsCausingServices: {
        requestChange: 'REQUEST';
    };
    matchesStates: 'idle' | 'idle.error' | 'idle.initial' | 'idle.success' | 'requesting' | {
        idle?: 'error' | 'initial' | 'success';
    };
    tags: never;
}
//# sourceMappingURL=change-email.typegen.d.ts.map