import Foundation

/// Controls whether managed request middleware may refresh a stored session.
/// Server configurations disable acquisition while retaining coordinated
/// persistence and clear operations.
public enum SessionAcquisitionPolicy: Sendable, Equatable {
    case automaticRefresh
    case noAutomaticRefresh
}

/// A complete session runtime configuration. Storage and coordination are
/// intentionally configured together so shared persistence cannot be requested
/// without an ownership mechanism.
public struct SessionManagementConfiguration: Sendable {
    let storage: any SessionStorageBackend
    let coordinator: any SessionCoordinator
    public let acquisitionPolicy: SessionAcquisitionPolicy

    /// Uses the platform's private default backend and a process-local
    /// coordinator. On Apple platforms the backend is a private Keychain item;
    /// elsewhere it is memory-backed.
    public init() {
        storage = defaultSessionStorageBackend()
        coordinator = ProcessLocalSessionCoordinator()
        acquisitionPolicy = .automaticRefresh
    }

    /// Couples custom persistence with an explicit coordinator and acquisition
    /// policy. Use ``processLocal(storage:acquisitionPolicy:)`` when the backend
    /// is not shared across processes.
    public init(
        storage: any SessionStorageBackend,
        coordinator: any SessionCoordinator,
        acquisitionPolicy: SessionAcquisitionPolicy
    ) {
        self.storage = storage
        self.coordinator = coordinator
        self.acquisitionPolicy = acquisitionPolicy
    }

    /// Convenience for custom storage that is private to this process.
    public static func processLocal(
        storage: any SessionStorageBackend,
        acquisitionPolicy: SessionAcquisitionPolicy = .automaticRefresh
    ) -> SessionManagementConfiguration {
        SessionManagementConfiguration(
            storage: storage,
            coordinator: ProcessLocalSessionCoordinator(),
            acquisitionPolicy: acquisitionPolicy
        )
    }

    /// Server-style persistence with coordinated mutations and no automatic
    /// refresh. The backend remains scoped by the caller (for example, per
    /// request or per user).
    public static func server(
        storage: any SessionStorageBackend,
        coordinator: any SessionCoordinator
    ) -> SessionManagementConfiguration {
        SessionManagementConfiguration(
            storage: storage,
            coordinator: coordinator,
            acquisitionPolicy: .noAutomaticRefresh
        )
    }

    /// Process-local convenience for server-style persistence.
    public static func server(
        storage: any SessionStorageBackend
    ) -> SessionManagementConfiguration {
        server(storage: storage, coordinator: ProcessLocalSessionCoordinator())
    }
}

#if canImport(Security) && canImport(Darwin)
public enum SharedSessionConfigurationError: Error, Sendable, Equatable {
    case emptyAccessGroup
    case unexpandedAccessGroup(String)
    case emptyAppGroupIdentifier
    case unexpandedAppGroupIdentifier(String)
    case emptyLockNamespace
    case invalidAcquisitionTimeout
    case appGroupContainerUnavailable(String)
}

extension SessionManagementConfiguration {
    /// Creates one shared Keychain session protected by a crash-released App
    /// Group file lock and same-process mutex. This factory fails closed when
    /// entitlement values are missing, unexpanded, or cannot resolve an App
    /// Group container; it never falls back to private or memory storage.
    public static func sharedKeychain(
        options: KeychainSessionStorageOptions,
        appGroupIdentifier: String,
        lockNamespace: String,
        acquisitionTimeout: TimeInterval
    ) throws -> SessionManagementConfiguration {
        try sharedKeychain(
            options: options,
            appGroupIdentifier: appGroupIdentifier,
            lockNamespace: lockNamespace,
            acquisitionTimeout: acquisitionTimeout,
            containerResolver: { identifier in
                FileManager.default.containerURL(
                    forSecurityApplicationGroupIdentifier: identifier
                )
            }
        )
    }

    static func sharedKeychain(
        options: KeychainSessionStorageOptions,
        appGroupIdentifier: String,
        lockNamespace: String,
        acquisitionTimeout: TimeInterval,
        containerResolver: (String) -> URL?
    ) throws -> SessionManagementConfiguration {
        guard let accessGroup = options.accessGroup?.trimmingCharacters(in: .whitespacesAndNewlines),
              !accessGroup.isEmpty else {
            throw SharedSessionConfigurationError.emptyAccessGroup
        }
        guard !containsUnexpandedBuildSetting(accessGroup) else {
            throw SharedSessionConfigurationError.unexpandedAccessGroup(accessGroup)
        }

        let appGroup = appGroupIdentifier.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !appGroup.isEmpty else {
            throw SharedSessionConfigurationError.emptyAppGroupIdentifier
        }
        guard !containsUnexpandedBuildSetting(appGroup) else {
            throw SharedSessionConfigurationError.unexpandedAppGroupIdentifier(appGroup)
        }

        let namespace = lockNamespace.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !namespace.isEmpty else {
            throw SharedSessionConfigurationError.emptyLockNamespace
        }
        guard acquisitionTimeout.isFinite, acquisitionTimeout > 0 else {
            throw SharedSessionConfigurationError.invalidAcquisitionTimeout
        }
        guard let container = containerResolver(appGroup) else {
            throw SharedSessionConfigurationError.appGroupContainerUnavailable(appGroup)
        }

        let digest = NhostSHA256.hexadecimalDigest(Data(namespace.utf8))
        let lockFileURL = container.appendingPathComponent(
            ".nhost-session-\(digest).lock",
            isDirectory: false
        )
        return SessionManagementConfiguration(
            storage: KeychainSessionStorageBackend(options: options),
            coordinator: FileSessionCoordinator(
                lockFileURL: lockFileURL,
                acquisitionTimeout: acquisitionTimeout
            ),
            acquisitionPolicy: .automaticRefresh
        )
    }

    private static func containsUnexpandedBuildSetting(_ value: String) -> Bool {
        value.contains("$(") || value.contains("${")
    }
}
#endif

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
    /// Coupled persistence, coordination, and session acquisition behavior.
    /// Not to be confused with the Storage (file) service configured by
    /// `storageURL`.
    public let sessionManagement: SessionManagementConfiguration
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
        sessionManagement: SessionManagementConfiguration = SessionManagementConfiguration(),
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
        self.sessionManagement = sessionManagement
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
    /// Server clients require explicit coupled session management and
    /// intentionally do not add automatic refresh middleware; they still
    /// coordinate Auth response persistence and clear operations and attach the
    /// stored token.
    public init(
        subdomain: String? = nil,
        region: String? = nil,
        authURL: URL? = nil,
        storageURL: URL? = nil,
        graphqlURL: URL? = nil,
        functionsURL: URL? = nil,
        sessionManagement: SessionManagementConfiguration,
        transport: any HTTPTransport = URLSessionTransport(),
        middleware: [ChainFunction] = [],
        defaultHeaders: [String: String] = [:],
        role: String? = nil,
        adminSession: AdminSessionOptions? = nil,
        graphqlCache: GraphQLCacheConfiguration? = nil
    ) {
        clientOptions = NhostClientOptions(
            subdomain: subdomain,
            region: region,
            authURL: authURL,
            storageURL: storageURL,
            graphqlURL: graphqlURL,
            functionsURL: functionsURL,
            sessionManagement: sessionManagement,
            transport: transport,
            middleware: middleware,
            defaultHeaders: defaultHeaders,
            role: role,
            adminSession: adminSession,
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
/// when neither a pair nor a custom URL is provided. Caller-supplied host
/// components are percent-encoded so malformed input cannot trap URL creation.
/// Mirrors nhost-js's `generateServiceUrl`.
public func generateServiceURL(
    _ service: NhostService,
    subdomain: String? = nil,
    region: String? = nil,
    customURL: URL? = nil
) -> URL {
    if let customURL {
        return customURL
    }

    if let subdomain,
       let region,
       let encodedSubdomain = subdomain.addingPercentEncoding(
           withAllowedCharacters: serviceURLHostComponentAllowedCharacters
       ),
       let encodedRegion = region.addingPercentEncoding(
           withAllowedCharacters: serviceURLHostComponentAllowedCharacters
       ) {
        let urlString = "https://\(encodedSubdomain).\(service.rawValue).\(encodedRegion).nhost.run/v1"

        if let url = URL(string: urlString) {
            return url
        }
    }

    // The fallback contains only SDK-owned URL components and is therefore a
    // valid absolute URL. Keeping the optional handling here prevents caller
    // input from ever reaching a trapping URL initializer.
    return URL(string: "https://local.\(service.rawValue).local.nhost.run/v1")!
}

private let serviceURLHostComponentAllowedCharacters = CharacterSet.alphanumerics.union(
    CharacterSet(charactersIn: "-._~")
)

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
/// required explicit `sessionManagement`, but never refreshed automatically. Mirrors
/// nhost-js's `createServerClient`.
public func createServerClient(_ options: NhostServerClientOptions) -> NhostClient {
    makeNhostClient(options: options.clientOptions, sessionMode: .server)
}
