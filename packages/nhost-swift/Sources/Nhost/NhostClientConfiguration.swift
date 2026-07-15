import Foundation

enum SessionMiddlewareMode {
    case none
    case client
    case server
}

func makeNhostClient(options: NhostClientOptions, sessionMode: SessionMiddlewareMode) -> NhostClient {
    let serviceURLs = configuredServiceURLs(options)
    let runtime = configuredManagedSessionRuntime(
        options: options,
        mode: sessionMode,
        authBaseURL: serviceURLs.auth
    )

    return NhostClient(
        auth: AuthClient(
            baseURL: serviceURLs.auth,
            transport: options.transport,
            middleware: runtime.authMiddleware
        ),
        storage: StorageClient(
            baseURL: serviceURLs.storage,
            transport: options.transport,
            middleware: runtime.serviceMiddleware
        ),
        graphql: GraphQLClient(
            url: serviceURLs.graphql,
            transport: options.transport,
            middleware: runtime.serviceMiddleware,
            cacheConfiguration: options.graphqlCache,
            cacheScopeContext: runtime.graphQLScopeContext,
            cacheClock: Date.init
        ),
        functions: FunctionsClient(
            baseURL: serviceURLs.functions,
            transport: options.transport,
            middleware: runtime.serviceMiddleware
        ),
        sessionStore: runtime.store,
        sessionRefresher: runtime.refresher,
        serviceURLs: serviceURLs
    )
}

private struct ManagedSessionRuntime {
    let store: SessionStore
    let refresher: SessionRefresher
    let authMiddleware: [ChainFunction]
    let serviceMiddleware: [ChainFunction]
    let graphQLScopeContext: GraphQLCacheClientScopeContext
}

private func configuredServiceURLs(_ options: NhostClientOptions) -> NhostServiceURLs {
    NhostServiceURLs(
        auth: generateServiceURL(
            .auth,
            subdomain: options.subdomain,
            region: options.region,
            customURL: options.authURL
        ),
        storage: generateServiceURL(
            .storage,
            subdomain: options.subdomain,
            region: options.region,
            customURL: options.storageURL
        ),
        graphql: generateServiceURL(
            .graphql,
            subdomain: options.subdomain,
            region: options.region,
            customURL: options.graphqlURL
        ),
        functions: generateServiceURL(
            .functions,
            subdomain: options.subdomain,
            region: options.region,
            customURL: options.functionsURL
        )
    )
}

private func configuredManagedSessionRuntime(
    options: NhostClientOptions,
    mode: SessionMiddlewareMode,
    authBaseURL: URL
) -> ManagedSessionRuntime {
    let store = SessionStore(storage: options.sessionStorage ?? defaultSessionStorageBackend())
    let commonMiddleware = configuredCommonMiddleware(options)
    let refreshAuth = AuthClient(
        baseURL: authBaseURL,
        transport: options.transport,
        middleware: commonMiddleware
    )
    let refresher = SessionRefresher(auth: refreshAuth, store: store)
    let authValidation = configuredManagedAuthValidationMiddleware(
        mode: mode,
        authBaseURL: authBaseURL
    )
    let authMiddleware = configuredSessionMiddleware(
        mode: mode,
        authBaseURL: authBaseURL,
        sessionStore: store,
        refresher: refresher,
        marginSeconds: options.sessionRefreshMarginSeconds
    ) + commonMiddleware + authValidation
    let serviceMiddleware = configuredSessionMiddleware(
        mode: mode,
        authBaseURL: nil,
        sessionStore: store,
        refresher: refresher,
        marginSeconds: options.sessionRefreshMarginSeconds
    ) + configuredPrivilegedServiceMiddleware(options) + commonMiddleware
    return ManagedSessionRuntime(
        store: store,
        refresher: refresher,
        authMiddleware: authMiddleware,
        serviceMiddleware: serviceMiddleware,
        graphQLScopeContext: configuredGraphQLScopeContext(options: options, mode: mode, store: store)
    )
}

private func configuredGraphQLScopeContext(
    options: NhostClientOptions,
    mode: SessionMiddlewareMode,
    store: SessionStore
) -> GraphQLCacheClientScopeContext {
    let usesManagedSession = mode != .none
    let transitionSubscriber: GraphQLCacheSessionTransitionSubscriber?
    if usesManagedSession {
        transitionSubscriber = { callback in
            store.observeTransitions(callback)
        }
    } else {
        transitionSubscriber = nil
    }
    return GraphQLCacheClientScopeContext(
        defaultHeaders: options.defaultHeaders,
        configuredRole: options.role,
        adminSession: options.adminSession,
        usesManagedSession: usesManagedSession,
        hasCustomMiddleware: !options.middleware.isEmpty,
        sessionSnapshot: { try await store.authorizationSnapshot() },
        subscribeToSessionTransitions: transitionSubscriber
    )
}

private func configuredCommonMiddleware(_ options: NhostClientOptions) -> [ChainFunction] {
    var middleware: [ChainFunction] = []

    if !options.defaultHeaders.isEmpty {
        middleware.append(headersMiddleware(options.defaultHeaders))
    }

    if let role = options.role {
        middleware.append(roleMiddleware(role))
    }

    middleware.append(contentsOf: options.middleware)
    return middleware
}

private func configuredPrivilegedServiceMiddleware(_ options: NhostClientOptions) -> [ChainFunction] {
    guard let adminSession = options.adminSession else {
        return []
    }

    return [adminSessionMiddleware(adminSession)]
}

private func configuredSessionMiddleware(
    mode: SessionMiddlewareMode,
    authBaseURL: URL?,
    sessionStore: SessionStore,
    refresher: SessionRefresher,
    marginSeconds: Int
) -> [ChainFunction] {
    switch mode {
    case .none:
        []
    case .client:
        [
            managedSessionMiddleware(
                authBaseURL: authBaseURL,
                sessionStore: sessionStore,
                refresher: refresher,
                marginSeconds: marginSeconds
            )
        ]
    case .server:
        [
            managedSessionMiddleware(
                authBaseURL: authBaseURL,
                sessionStore: sessionStore,
                refresher: nil,
                marginSeconds: marginSeconds
            )
        ]
    }
}

private func configuredManagedAuthValidationMiddleware(
    mode: SessionMiddlewareMode,
    authBaseURL: URL
) -> [ChainFunction] {
    switch mode {
    case .none:
        []
    case .client, .server:
        [managedAuthRequestValidationMiddleware(authBaseURL: authBaseURL)]
    }
}
