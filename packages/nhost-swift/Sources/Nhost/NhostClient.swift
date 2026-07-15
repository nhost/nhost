import Foundation

public enum NhostService: String, Sendable, CaseIterable {
    case auth
    case storage
    case graphql
    case functions
}

public struct NhostServiceURLs: Sendable, Equatable {
    public let auth: URL
    public let storage: URL
    public let graphql: URL
    public let functions: URL

    public init(auth: URL, storage: URL, graphql: URL, functions: URL) {
        self.auth = auth
        self.storage = storage
        self.graphql = graphql
        self.functions = functions
    }
}

public struct NhostClientOptions: Sendable {
    public let subdomain: String?
    public let region: String?
    public let authURL: URL?
    public let storageURL: URL?
    public let graphqlURL: URL?
    public let functionsURL: URL?
    /// Backend used to persist the user session. Not to be confused with the
    /// Storage (file) service, which is configured via `storageURL`.
    public let sessionStorage: (any SessionStorageBackend)?
    public let transport: any HTTPTransport
    public let middleware: [ChainFunction]
    public let defaultHeaders: [String: String]
    public let role: String?
    public let adminSession: AdminSessionOptions?
    public let sessionRefreshMarginSeconds: Int
    public let graphqlCache: GraphQLCacheConfiguration?

    public init(
        subdomain: String? = nil,
        region: String? = nil,
        authURL: URL? = nil,
        storageURL: URL? = nil,
        graphqlURL: URL? = nil,
        functionsURL: URL? = nil,
        sessionStorage: (any SessionStorageBackend)? = nil,
        transport: any HTTPTransport = URLSessionTransport(),
        middleware: [ChainFunction] = [],
        defaultHeaders: [String: String] = [:],
        role: String? = nil,
        adminSession: AdminSessionOptions? = nil,
        sessionRefreshMarginSeconds: Int = 60,
        graphqlCache: GraphQLCacheConfiguration? = nil
    ) {
        self.subdomain = subdomain
        self.region = region
        self.authURL = authURL
        self.storageURL = storageURL
        self.graphqlURL = graphqlURL
        self.functionsURL = functionsURL
        self.sessionStorage = sessionStorage
        self.transport = transport
        self.middleware = middleware
        self.defaultHeaders = defaultHeaders
        self.role = role
        self.adminSession = adminSession
        self.sessionRefreshMarginSeconds = sessionRefreshMarginSeconds
        self.graphqlCache = graphqlCache
    }
}

public struct NhostServerClientOptions: Sendable {
    public let clientOptions: NhostClientOptions

    /// Creates a trusted-context/server-style client configuration.
    ///
    /// Server clients require explicit custom session storage and intentionally do not add
    /// automatic refresh middleware; they still update storage from Auth responses and attach
    /// the stored token.
    public init(
        subdomain: String? = nil,
        region: String? = nil,
        authURL: URL? = nil,
        storageURL: URL? = nil,
        graphqlURL: URL? = nil,
        functionsURL: URL? = nil,
        sessionStorage: any SessionStorageBackend,
        transport: any HTTPTransport = URLSessionTransport(),
        middleware: [ChainFunction] = [],
        defaultHeaders: [String: String] = [:],
        role: String? = nil,
        adminSession: AdminSessionOptions? = nil,
        sessionRefreshMarginSeconds: Int = 60,
        graphqlCache: GraphQLCacheConfiguration? = nil
    ) {
        clientOptions = NhostClientOptions(
            subdomain: subdomain,
            region: region,
            authURL: authURL,
            storageURL: storageURL,
            graphqlURL: graphqlURL,
            functionsURL: functionsURL,
            sessionStorage: sessionStorage,
            transport: transport,
            middleware: middleware,
            defaultHeaders: defaultHeaders,
            role: role,
            adminSession: adminSession,
            sessionRefreshMarginSeconds: sessionRefreshMarginSeconds,
            graphqlCache: graphqlCache
        )
    }
}

public struct NhostClient: Sendable {
    public let auth: AuthClient
    public let storage: StorageClient
    public let graphql: GraphQLClient
    public let functions: FunctionsClient
    public let sessionStore: SessionStore
    public let sessionRefresher: SessionRefresher
    public let serviceURLs: NhostServiceURLs

    public init(
        auth: AuthClient,
        storage: StorageClient,
        graphql: GraphQLClient,
        functions: FunctionsClient,
        sessionStore: SessionStore,
        sessionRefresher: SessionRefresher,
        serviceURLs: NhostServiceURLs
    ) {
        self.auth = auth
        self.storage = storage
        self.graphql = graphql
        self.functions = functions
        self.sessionStore = sessionStore
        self.sessionRefresher = sessionRefresher
        self.serviceURLs = serviceURLs
    }

    public func getUserSession() async throws -> StoredSession? {
        try await sessionStore.get()
    }

    public func refreshSession(marginSeconds: Int = 60) async throws -> StoredSession? {
        try await sessionRefresher.refreshSession(marginSeconds: marginSeconds)
    }

    public func clearSession() async throws {
        try await sessionStore.remove()
    }
}

/// Builds the URL of an Nhost service from a subdomain/region pair, falling back
/// to the local dev environment (`https://local.{service}.local.nhost.run/v1`)
/// when neither a pair nor a custom URL is provided. Mirrors nhost-js's
/// `generateServiceUrl`.
public func generateServiceURL(
    _ service: NhostService,
    subdomain: String? = nil,
    region: String? = nil,
    customURL: URL? = nil
) -> URL {
    if let customURL {
        return customURL
    }

    let urlString = if let subdomain, let region {
        "https://\(subdomain).\(service.rawValue).\(region).nhost.run/v1"
    } else {
        "https://local.\(service.rawValue).local.nhost.run/v1"
    }

    guard let url = URL(string: urlString) else {
        preconditionFailure("Invalid Nhost service URL derived from subdomain/region: \(urlString)")
    }

    return url
}

/// Creates a client with **no session middleware**: nothing is persisted, refreshed,
/// or attached automatically. Use it for admin or service contexts (typically with
/// `adminSession`) or when you manage sessions yourself. Mirrors nhost-js's
/// `createNhostClient`; for the session-managed client most apps want, use
/// ``createClient(_:)``.
public func createNhostClient(_ options: NhostClientOptions = NhostClientOptions()) -> NhostClient {
    makeNhostClient(options: options, sessionMode: .none)
}

/// Creates the fully session-managed client most apps want: requests proactively
/// refresh the session when it is about to expire, sessions returned by Auth
/// endpoints are persisted, and the stored access token is attached as a Bearer
/// header. Mirrors nhost-js's `createClient`; for a client without any session
/// middleware, use ``createNhostClient(_:)``.
public func createClient(_ options: NhostClientOptions = NhostClientOptions()) -> NhostClient {
    makeNhostClient(options: options, sessionMode: .client)
}

/// Creates a server-style client: sessions are persisted and attached from the
/// required explicit `sessionStorage`, but never refreshed automatically. Mirrors
/// nhost-js's `createServerClient`.
public func createServerClient(_ options: NhostServerClientOptions) -> NhostClient {
    makeNhostClient(options: options.clientOptions, sessionMode: .server)
}

private enum SessionMiddlewareMode {
    case none
    case client
    case server
}

private func makeNhostClient(options: NhostClientOptions, sessionMode: SessionMiddlewareMode) -> NhostClient {
    let serviceURLs = NhostServiceURLs(
        auth: generateServiceURL(.auth, subdomain: options.subdomain, region: options.region, customURL: options.authURL),
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

    let sessionStore = SessionStore(storage: options.sessionStorage ?? defaultSessionStorageBackend())
    let commonMiddleware = configuredCommonMiddleware(options)
    let refreshAuth = AuthClient(baseURL: serviceURLs.auth, transport: options.transport, middleware: commonMiddleware)
    let refresher = SessionRefresher(auth: refreshAuth, store: sessionStore)
    let sessionMiddleware = configuredSessionMiddleware(
        mode: sessionMode,
        sessionStore: sessionStore,
        refresher: refresher,
        marginSeconds: options.sessionRefreshMarginSeconds
    )

    // Session middleware runs outermost and user/common middleware innermost,
    // matching nhost-js: custom middleware observes the attached Bearer token,
    // and one that sets Authorization itself cannot suppress refresh/attach.
    let authMiddleware = sessionMiddleware + commonMiddleware
    let privilegedServiceMiddleware = sessionMiddleware + configuredPrivilegedServiceMiddleware(options) + commonMiddleware

    let usesManagedSession: Bool
    switch sessionMode {
    case .none:
        usesManagedSession = false
    case .client, .server:
        usesManagedSession = true
    }
    let transitionSubscriber: GraphQLCacheSessionTransitionSubscriber?
    if usesManagedSession {
        transitionSubscriber = { callback in
            sessionStore.observeTransitions(callback)
        }
    } else {
        transitionSubscriber = nil
    }
    let graphQLScopeContext = GraphQLCacheClientScopeContext(
        defaultHeaders: options.defaultHeaders,
        configuredRole: options.role,
        adminSession: options.adminSession,
        usesManagedSession: usesManagedSession,
        hasCustomMiddleware: !options.middleware.isEmpty,
        sessionSnapshot: { try await sessionStore.authorizationSnapshot() },
        subscribeToSessionTransitions: transitionSubscriber
    )

    return NhostClient(
        auth: AuthClient(
            baseURL: serviceURLs.auth,
            transport: options.transport,
            middleware: authMiddleware
        ),
        storage: StorageClient(
            baseURL: serviceURLs.storage,
            transport: options.transport,
            middleware: privilegedServiceMiddleware
        ),
        graphql: GraphQLClient(
            url: serviceURLs.graphql,
            transport: options.transport,
            middleware: privilegedServiceMiddleware,
            cacheConfiguration: options.graphqlCache,
            cacheScopeContext: graphQLScopeContext,
            cacheClock: Date.init
        ),
        functions: FunctionsClient(
            baseURL: serviceURLs.functions,
            transport: options.transport,
            middleware: privilegedServiceMiddleware
        ),
        sessionStore: sessionStore,
        sessionRefresher: refresher,
        serviceURLs: serviceURLs
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
    sessionStore: SessionStore,
    refresher: SessionRefresher,
    marginSeconds: Int
) -> [ChainFunction] {
    switch mode {
    case .none:
        []
    case .client:
        [
            sessionRefreshMiddleware(refresher: refresher, marginSeconds: marginSeconds),
            updateSessionFromResponseMiddleware(sessionStore: sessionStore),
            attachAccessTokenMiddleware(sessionStore: sessionStore)
        ]
    case .server:
        [
            updateSessionFromResponseMiddleware(sessionStore: sessionStore),
            attachAccessTokenMiddleware(sessionStore: sessionStore)
        ]
    }
}
