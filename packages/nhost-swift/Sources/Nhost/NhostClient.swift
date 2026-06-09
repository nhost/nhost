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
    public let storage: (any SessionStorageBackend)?
    public let transport: any HTTPTransport
    public let middleware: [ChainFunction]
    public let defaultHeaders: [String: String]
    public let role: String?
    public let adminSession: AdminSessionOptions?
    public let sessionRefreshMarginSeconds: Int

    public init(
        subdomain: String? = nil,
        region: String? = nil,
        authURL: URL? = nil,
        storageURL: URL? = nil,
        graphqlURL: URL? = nil,
        functionsURL: URL? = nil,
        storage: (any SessionStorageBackend)? = nil,
        transport: any HTTPTransport = URLSessionTransport(),
        middleware: [ChainFunction] = [],
        defaultHeaders: [String: String] = [:],
        role: String? = nil,
        adminSession: AdminSessionOptions? = nil,
        sessionRefreshMarginSeconds: Int = 60
    ) {
        self.subdomain = subdomain
        self.region = region
        self.authURL = authURL
        self.storageURL = storageURL
        self.graphqlURL = graphqlURL
        self.functionsURL = functionsURL
        self.storage = storage
        self.transport = transport
        self.middleware = middleware
        self.defaultHeaders = defaultHeaders
        self.role = role
        self.adminSession = adminSession
        self.sessionRefreshMarginSeconds = sessionRefreshMarginSeconds
    }
}

public struct NhostServerClientOptions: Sendable {
    public let clientOptions: NhostClientOptions

    /// Creates a trusted-context/server-style client configuration.
    ///
    /// Server clients require explicit custom storage and intentionally do not add automatic
    /// refresh middleware; they still update storage from Auth responses and attach the stored token.
    public init(
        subdomain: String? = nil,
        region: String? = nil,
        authURL: URL? = nil,
        storageURL: URL? = nil,
        graphqlURL: URL? = nil,
        functionsURL: URL? = nil,
        storage: any SessionStorageBackend,
        transport: any HTTPTransport = URLSessionTransport(),
        middleware: [ChainFunction] = [],
        defaultHeaders: [String: String] = [:],
        role: String? = nil,
        adminSession: AdminSessionOptions? = nil,
        sessionRefreshMarginSeconds: Int = 60
    ) {
        clientOptions = NhostClientOptions(
            subdomain: subdomain,
            region: region,
            authURL: authURL,
            storageURL: storageURL,
            graphqlURL: graphqlURL,
            functionsURL: functionsURL,
            storage: storage,
            transport: transport,
            middleware: middleware,
            defaultHeaders: defaultHeaders,
            role: role,
            adminSession: adminSession,
            sessionRefreshMarginSeconds: sessionRefreshMarginSeconds
        )
    }
}

public struct NhostClient: Sendable {
    public let auth: AuthClient
    public let storage: StorageClient
    public let sessionStore: SessionStore
    public let sessionRefresher: SessionRefresher
    public let serviceURLs: NhostServiceURLs

    public init(
        auth: AuthClient,
        storage: StorageClient,
        sessionStore: SessionStore,
        sessionRefresher: SessionRefresher,
        serviceURLs: NhostServiceURLs
    ) {
        self.auth = auth
        self.storage = storage
        self.sessionStore = sessionStore
        self.sessionRefresher = sessionRefresher
        self.serviceURLs = serviceURLs
    }

    public func getUserSession() async throws -> StoredSession? {
        try await sessionStore.get()
    }

    public func refreshSession(marginSeconds: Int = 60) async -> StoredSession? {
        await sessionRefresher.refreshSession(marginSeconds: marginSeconds)
    }

    public func clearSession() async throws {
        try await sessionStore.remove()
    }
}

public func generateServiceUrl(
    _ service: NhostService,
    subdomain: String? = nil,
    region: String? = nil,
    customURL: URL? = nil
) -> URL {
    if let customURL {
        return customURL
    }

    if let subdomain, let region {
        return URL(string: "https://\(subdomain).\(service.rawValue).\(region).nhost.run/v1")!
    }

    return URL(string: "https://local.\(service.rawValue).local.nhost.run/v1")!
}

public func createNhostClient(_ options: NhostClientOptions = NhostClientOptions()) -> NhostClient {
    makeNhostClient(options: options, sessionMode: .none)
}

public func createClient(_ options: NhostClientOptions = NhostClientOptions()) -> NhostClient {
    makeNhostClient(options: options, sessionMode: .client)
}

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
        auth: generateServiceUrl(.auth, subdomain: options.subdomain, region: options.region, customURL: options.authURL),
        storage: generateServiceUrl(
            .storage,
            subdomain: options.subdomain,
            region: options.region,
            customURL: options.storageURL
        ),
        graphql: generateServiceUrl(
            .graphql,
            subdomain: options.subdomain,
            region: options.region,
            customURL: options.graphqlURL
        ),
        functions: generateServiceUrl(
            .functions,
            subdomain: options.subdomain,
            region: options.region,
            customURL: options.functionsURL
        )
    )

    let sessionStore = SessionStore(storage: options.storage ?? defaultSessionStorageBackend())
    let commonMiddleware = configuredCommonMiddleware(options)
    let refreshAuth = AuthClient(baseURL: serviceURLs.auth, transport: options.transport, middleware: commonMiddleware)
    let refresher = SessionRefresher(auth: refreshAuth, store: sessionStore)
    let sessionMiddleware = configuredSessionMiddleware(
        mode: sessionMode,
        sessionStore: sessionStore,
        refresher: refresher,
        marginSeconds: options.sessionRefreshMarginSeconds
    )

    let authMiddleware = commonMiddleware + sessionMiddleware
    let storageMiddleware = commonMiddleware + configuredStorageMiddleware(options) + sessionMiddleware

    return NhostClient(
        auth: AuthClient(baseURL: serviceURLs.auth, transport: options.transport, middleware: authMiddleware),
        storage: StorageClient(baseURL: serviceURLs.storage, transport: options.transport, middleware: storageMiddleware),
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

private func configuredStorageMiddleware(_ options: NhostClientOptions) -> [ChainFunction] {
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
            attachAccessTokenMiddleware(sessionStore: sessionStore),
        ]
    case .server:
        [
            updateSessionFromResponseMiddleware(sessionStore: sessionStore),
            attachAccessTokenMiddleware(sessionStore: sessionStore),
        ]
    }
}
