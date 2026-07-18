import Foundation

enum SessionMiddlewareMode {
    case none
    case client
    case server
}

/// Controls how the origin-scoped Apple Keychain default handles the one
/// unscoped item written by SDK versions that predate origin isolation.
public enum LegacyDefaultSessionMigrationPolicy: Sendable, Equatable {
    /// Fail reads when the legacy item exists, preserving it until the app makes
    /// an explicit origin-ownership decision.
    case requireExplicitDecision
    /// Atomically move the legacy item to this client's resolved Auth origin.
    /// Select this only when the app knows the legacy session belongs there.
    case migrateToCurrentAuthOrigin
    /// Leave the legacy item untouched and treat it as unrelated to this client.
    case ignore
}

/// Stable, credential-free identity for the private default session belonging
/// to one resolved Auth base URL.
struct DefaultSessionPersistenceIdentity: Equatable, Sendable {
    let digest: String

    init(authBaseURL: URL) {
        digest = NhostSHA256.hexadecimalDigest(
            Data(Self.canonicalAuthScope(authBaseURL).utf8)
        )
    }

    var keychainAccountPrefix: String { "origin.\(digest)" }
    var processCoordinationKey: String { "nhost.default-session.\(digest)" }

    private static func canonicalAuthScope(_ url: URL) -> String {
        guard var components = URLComponents(
            url: url.absoluteURL.standardized,
            resolvingAgainstBaseURL: true
        ), let scheme = components.scheme, let host = components.host else {
            return url.absoluteString
        }

        components.scheme = scheme.lowercased()
        components.host = host.lowercased()
        components.user = nil
        components.password = nil
        components.query = nil
        components.fragment = nil
        if (components.scheme == "https" && components.port == 443)
            || (components.scheme == "http" && components.port == 80) {
            components.port = nil
        }

        var path = components.percentEncodedPath
        while path.count > 1, path.hasSuffix("/") {
            path.removeLast()
        }
        components.percentEncodedPath = path.isEmpty ? "/" : path
        return components.string ?? url.absoluteString
    }
}

extension SessionManagementConfiguration {
    func resolved(authBaseURL: URL) -> (
        storage: any SessionStorageBackend,
        coordinator: any SessionCoordinator
    ) {
        guard let legacyDefaultSessionMigration else {
            return (storage, coordinator)
        }

        #if canImport(Security)
        let identity = DefaultSessionPersistenceIdentity(authBaseURL: authBaseURL)
        let options = KeychainSessionStorageOptions(
            accountPrefix: identity.keychainAccountPrefix
        )
        return (
            KeychainSessionStorageBackend(
                options: options,
                legacyOptions: KeychainSessionStorageOptions(),
                legacyMigration: legacyDefaultSessionMigration
            ),
            ProcessLocalSessionCoordinator(identity: identity.processCoordinationKey)
        )
        #else
        return (storage, coordinator)
        #endif
    }
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
    let sessionManagement = options.sessionManagement.resolved(authBaseURL: authBaseURL)
    let store = SessionStore(
        storage: sessionManagement.storage,
        coordinator: sessionManagement.coordinator
    )
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
        acquisitionPolicy: options.sessionManagement.acquisitionPolicy,
        marginSeconds: options.sessionRefreshMarginSeconds
    ) + commonMiddleware + authValidation
    let serviceMiddleware = configuredSessionMiddleware(
        mode: mode,
        authBaseURL: Optional<URL>.none,
        sessionStore: store,
        refresher: refresher,
        acquisitionPolicy: options.sessionManagement.acquisitionPolicy,
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
    let sessionSnapshot: @Sendable () async throws -> SessionAuthorizationSnapshot?
    let transitionSubscriber: GraphQLCacheSessionTransitionSubscriber?
    if usesManagedSession {
        sessionSnapshot = { try await store.authorizationSnapshot() }
        transitionSubscriber = { callback in
            store.observeTransitions(callback)
        }
    } else {
        sessionSnapshot = { nil }
        transitionSubscriber = nil
    }
    return GraphQLCacheClientScopeContext(
        defaultHeaders: options.defaultHeaders,
        configuredRole: options.role,
        adminSession: options.adminSession,
        usesManagedSession: usesManagedSession,
        hasCustomMiddleware: !options.middleware.isEmpty,
        sessionSnapshot: sessionSnapshot,
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
    acquisitionPolicy: SessionAcquisitionPolicy,
    marginSeconds: Int
) -> [ChainFunction] {
    switch mode {
    case .none:
        []
    case .client:
        switch acquisitionPolicy {
        case .automaticRefresh:
            [
                managedSessionMiddleware(
                    authBaseURL: authBaseURL,
                    sessionStore: sessionStore,
                    refresher: refresher,
                    marginSeconds: marginSeconds
                )
            ]
        case .noAutomaticRefresh:
            [
                managedSessionMiddleware(
                    authBaseURL: authBaseURL,
                    sessionStore: sessionStore,
                    refresher: nil,
                    marginSeconds: 0
                )
            ]
        }
    case .server:
        [
            managedSessionMiddleware(
                authBaseURL: authBaseURL,
                sessionStore: sessionStore,
                refresher: nil,
                marginSeconds: 0
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
