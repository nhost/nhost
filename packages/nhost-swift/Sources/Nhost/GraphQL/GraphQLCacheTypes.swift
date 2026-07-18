import Foundation

/// Cache behavior for a single GraphQL request. Caching is opt-in and the
/// source-compatible default remains ``networkOnly``.
public enum GraphQLCachePolicy: Sendable, Equatable {
    /// Uses the legacy request path and performs no cache initialization, clock,
    /// store, classifier, resolver, prune, touch, or diagnostic work.
    case networkOnly
    /// Returns only a fresh, compatible cached value. Read and validation
    /// failures are surfaced as their corresponding ``GraphQLCacheError`` and
    /// no network call is made; LRU touch persistence is best effort after a hit.
    case cacheOnly
    /// Returns a fresh compatible value or performs one legacy network request.
    /// Cache-side failures recover as misses and successful writes are best effort.
    case cacheFirst
    /// Performs one legacy network request first. Only `FetchError.transport`
    /// may fall back to a compatible value inside the bounded stale window; the
    /// original transport error remains primary if cache fallback cannot succeed.
    case networkFirst
}

/// Per-request cache dimensions. Namespace and tags only add dimensions to the
/// protected SDK-generated identity; they never replace endpoint, query,
/// variables, operation, or authorization dimensions.
public struct GraphQLCacheRequestOptions: Sendable, Equatable {
    public let policy: GraphQLCachePolicy
    public let namespace: String?
    public let tags: Set<String>

    public init(
        policy: GraphQLCachePolicy = .networkOnly,
        namespace: String? = nil,
        tags: Set<String> = []
    ) {
        self.policy = policy
        self.namespace = namespace
        self.tags = tags
    }
}

/// Data-protection class applied by the default file store on Apple platforms.
/// It is a portability no-op on platforms that do not expose file protection.
public enum GraphQLCacheFileProtection: String, Codable, Sendable, Equatable {
    case none
    case complete
    case completeUnlessOpen
    case completeUntilFirstUserAuthentication
}

/// Which authorization grouping an explicit invalidation targets.
public enum GraphQLCacheInvalidationScope: Sendable, Equatable {
    /// Invalidates the protected authorization scope derived for a synthetic
    /// `query NhostCacheScope { __typename }` request with no per-call headers.
    /// Resolver-augmented entries match only when the augmentation is stable for
    /// that synthetic context. For request-varying grouping, use namespace/tag
    /// filters or ``user(_:)`` for managed-session scopes.
    case current
    /// Invalidates every managed-session role and claims scope associated with
    /// this caller-supplied user identifier. The identifier should be the Nhost
    /// user ID represented by the token subject; the SDK hashes it internally
    /// before passing it to a store. Anonymous, explicit-authorization, and
    /// admin entries have no managed-user facet and do not match this scope.
    case user(String)
}

/// Public, AND-composed invalidation filter. Nil fields do not constrain the
/// match, so an entirely empty filter removes every entry visible to the cache
/// store. Age filters are inclusive, use creation/write timestamps, and never
/// use last access.
public struct GraphQLCacheInvalidationFilter: Sendable, Equatable {
    public let endpoint: URL?
    public let scope: GraphQLCacheInvalidationScope?
    public let operationName: String?
    public let namespace: String?
    public let tag: String?
    public let createdAtOrBefore: Date?
    public let lastSuccessfulWriteAtOrBefore: Date?

    public init(
        endpoint: URL? = nil,
        scope: GraphQLCacheInvalidationScope? = nil,
        operationName: String? = nil,
        namespace: String? = nil,
        tag: String? = nil,
        createdAtOrBefore: Date? = nil,
        lastSuccessfulWriteAtOrBefore: Date? = nil
    ) {
        self.endpoint = endpoint
        self.scope = scope
        self.operationName = operationName
        self.namespace = namespace
        self.tag = tag
        self.createdAtOrBefore = createdAtOrBefore
        self.lastSuccessfulWriteAtOrBefore = lastSuccessfulWriteAtOrBefore
    }
}

/// Cache-specific failures. Network-capable policies recover from configuration,
/// scope, key, read, and write failures as defined by their policy; cache-only
/// and explicit management operations surface these errors. Decoder
/// incompatibility remains primary if best-effort eviction also fails, and a
/// network-first cache failure never replaces the original transport error.
/// A confirmed protected-state mismatch is `authorizationScopeChanged`; an
/// authorization snapshot that cannot be read is `unavailableScope`.
public enum GraphQLCacheError: Error, Sendable, Equatable {
    case notConfigured
    case miss
    case expired
    case decoderIncompatible
    case ineligibleOperation
    case keyGenerationFailed
    case unavailableScope
    case storeFailure(String)
    case oversizedEntry(actualBytes: Int, maximumBytes: Int)
    case invalidConfiguration(String)
    case authorizationScopeChanged
}

extension GraphQLCacheError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .notConfigured:
            "GraphQL response caching is not configured"
        case .miss:
            "No GraphQL cache entry exists for this request"
        case .expired:
            "The GraphQL cache entry is expired"
        case .decoderIncompatible:
            "The GraphQL cache entry is incompatible with the requested decoder or model"
        case .ineligibleOperation:
            "The selected GraphQL operation is not an eligible query"
        case .keyGenerationFailed:
            "The GraphQL cache key could not be generated"
        case .unavailableScope:
            "A protected GraphQL cache authorization scope is unavailable"
        case let .storeFailure(message):
            "The GraphQL cache store failed: \(message)"
        case let .oversizedEntry(actualBytes, maximumBytes):
            "The GraphQL cache entry is \(actualBytes) bytes; the limit is \(maximumBytes) bytes"
        case let .invalidConfiguration(message):
            "Invalid GraphQL cache configuration: \(message)"
        case .authorizationScopeChanged:
            "The GraphQL authorization scope changed while the request was in progress"
        }
    }
}

public enum GraphQLCacheSource: Sendable, Equatable {
    case cached
    case fresh
}

/// Sanitized outcome of attempting to persist a fresh response.
public enum GraphQLCachePersistenceOutcome: Sendable, Equatable {
    case stored
    case notAttempted
    case skipped
    case failedAndReported
}

/// Metadata accompanying both cached and fresh stream emissions.
public struct GraphQLCacheMetadata: Sendable, Equatable {
    public let source: GraphQLCacheSource
    public let createdAt: Date
    public let lastSuccessfulWriteAt: Date
    public let age: TimeInterval
    public let isExpired: Bool
    public let status: Int
    public let persistenceOutcome: GraphQLCachePersistenceOutcome

    public init(
        source: GraphQLCacheSource,
        createdAt: Date,
        lastSuccessfulWriteAt: Date,
        age: TimeInterval,
        isExpired: Bool,
        status: Int,
        persistenceOutcome: GraphQLCachePersistenceOutcome
    ) {
        self.source = source
        self.createdAt = createdAt
        self.lastSuccessfulWriteAt = lastSuccessfulWriteAt
        self.age = age
        self.isExpired = isExpired
        self.status = status
        self.persistenceOutcome = persistenceOutcome
    }
}

/// A stale-while-revalidate emission carrying the same response shape as the
/// existing single-response GraphQL API.
public enum GraphQLCacheResult<ResponseData: Decodable & Sendable>: Sendable {
    case cached(
        NhostResponse<GraphQLResponse<ResponseData>>,
        metadata: GraphQLCacheMetadata
    )
    case fresh(
        NhostResponse<GraphQLResponse<ResponseData>>,
        metadata: GraphQLCacheMetadata
    )
}

extension GraphQLCacheResult: Equatable where ResponseData: Equatable {}

/// Sanitized SDK-derived scope data supplied to a custom resolver.
public struct GraphQLCacheSDKScope: Sendable, Equatable {
    public enum AuthorizationMode: Sendable, Equatable {
        case anonymous
        case managedSession
        case explicitAuthorization
        case admin
    }

    public let authorizationMode: AuthorizationMode
    public let effectiveRole: String?
    public let userIdentityDigest: String?

    public init(
        authorizationMode: AuthorizationMode,
        effectiveRole: String? = nil,
        userIdentityDigest: String? = nil
    ) {
        self.authorizationMode = authorizationMode
        self.effectiveRole = effectiveRole
        self.userIdentityDigest = userIdentityDigest
    }
}

/// Preflight-only resolver input. It intentionally has no response or terminal
/// transport state and therefore cannot attest an opaque fetch function.
public struct GraphQLCacheScopeResolverContext: Sendable, Equatable {
    public let endpoint: URL
    public let request: GraphQLRequest
    public let headers: [String: String]
    public let sdkScope: GraphQLCacheSDKScope

    public init(
        endpoint: URL,
        request: GraphQLRequest,
        headers: [String: String],
        sdkScope: GraphQLCacheSDKScope
    ) {
        self.endpoint = endpoint
        self.request = request
        self.headers = headers
        self.sdkScope = sdkScope
    }
}

/// Resolver augmentation combined with mandatory SDK-derived dimensions. Header
/// names and values are exact preflight expectations that must match the final
/// request before a response can be associated with the cache.
public struct GraphQLCacheCustomScope: Sendable, Equatable {
    public let identifier: String
    public let protectedHeaders: [String: String]
    public let varyHeaders: [String: String]

    public init(
        identifier: String,
        protectedHeaders: [String: String] = [:],
        varyHeaders: [String: String] = [:]
    ) {
        self.identifier = identifier
        self.protectedHeaders = protectedHeaders
        self.varyHeaders = varyHeaders
    }
}

public typealias GraphQLCacheScopeResolver = @Sendable (
    GraphQLCacheScopeResolverContext
) async throws -> GraphQLCacheCustomScope?

/// Sanitized cache diagnostic categories. Confirmed session and final-request
/// mismatches are distinguished from transient `unavailableScope` failures.
public enum GraphQLCacheDiagnosticKind: Sendable, Equatable {
    case invalidConfiguration
    case unavailableScope
    case keyGenerationFailure
    case storeReadFailure
    case storeWriteFailure
    case storeTouchFailure
    case storePruneFailure
    case storeInvalidationFailure
    case cleanupFailure
    case decoderIncompatible
    case protectedRequestStateChanged
    case sessionAuthorizationChanged
    case oversizedEntry
    case clockRollback
    case unverifiableRequest
}

/// Privacy-sanitized cache diagnostic. Messages must not include raw request or
/// authorization inputs.
public struct GraphQLCacheDiagnostic: Sendable, Equatable {
    public let kind: GraphQLCacheDiagnosticKind
    public let message: String

    public init(kind: GraphQLCacheDiagnosticKind, message: String) {
        self.kind = kind
        self.message = message
    }
}

public typealias GraphQLCacheDiagnosticObserver = @Sendable (GraphQLCacheDiagnostic) -> Void

/// Opt-in persistent cache configuration. Validation is deferred until a cache
/// operation so constructing a client remains nonthrowing and `.networkOnly`
/// performs no cache-related work.
public struct GraphQLCacheConfiguration: Sendable {
    public static let defaultFreshnessTTL: TimeInterval = 5 * 60
    public static let defaultStaleIfErrorInterval: TimeInterval = 24 * 60 * 60
    public static let defaultMaximumTotalBytes = 50 * 1_024 * 1_024
    public static let defaultMaximumEntryBytes = 5 * 1_024 * 1_024
    public static let defaultMaximumEntries = 1_000

    public let freshnessTTL: TimeInterval
    public let staleIfErrorInterval: TimeInterval
    public let maximumTotalBytes: Int
    public let maximumEntryBytes: Int
    public let maximumEntries: Int
    public let directoryURL: URL?
    public let fileProtection: GraphQLCacheFileProtection
    public let purgePreviousScopeOnSignOut: Bool
    public let store: (any GraphQLCacheStore)?
    public let scopeResolver: GraphQLCacheScopeResolver?
    public let diagnosticObserver: GraphQLCacheDiagnosticObserver?

    public init(
        freshnessTTL: TimeInterval = GraphQLCacheConfiguration.defaultFreshnessTTL,
        staleIfErrorInterval: TimeInterval = GraphQLCacheConfiguration.defaultStaleIfErrorInterval,
        maximumTotalBytes: Int = GraphQLCacheConfiguration.defaultMaximumTotalBytes,
        maximumEntryBytes: Int = GraphQLCacheConfiguration.defaultMaximumEntryBytes,
        maximumEntries: Int = GraphQLCacheConfiguration.defaultMaximumEntries,
        directoryURL: URL? = nil,
        fileProtection: GraphQLCacheFileProtection = .completeUntilFirstUserAuthentication,
        purgePreviousScopeOnSignOut: Bool = true,
        store: (any GraphQLCacheStore)? = nil,
        scopeResolver: GraphQLCacheScopeResolver? = nil,
        diagnosticObserver: GraphQLCacheDiagnosticObserver? = nil
    ) {
        self.freshnessTTL = freshnessTTL
        self.staleIfErrorInterval = staleIfErrorInterval
        self.maximumTotalBytes = maximumTotalBytes
        self.maximumEntryBytes = maximumEntryBytes
        self.maximumEntries = maximumEntries
        self.directoryURL = directoryURL
        self.fileProtection = fileProtection
        self.purgePreviousScopeOnSignOut = purgePreviousScopeOnSignOut
        self.store = store
        self.scopeResolver = scopeResolver
        self.diagnosticObserver = diagnosticObserver
    }

    /// Checks all bounds without touching the clock, store, or filesystem.
    public func validate() throws {
        guard freshnessTTL.isFinite, freshnessTTL >= 0 else {
            throw GraphQLCacheError.invalidConfiguration("freshnessTTL must be finite and nonnegative")
        }
        guard staleIfErrorInterval.isFinite, staleIfErrorInterval >= 0 else {
            throw GraphQLCacheError.invalidConfiguration(
                "staleIfErrorInterval must be finite and nonnegative"
            )
        }
        guard (freshnessTTL + staleIfErrorInterval).isFinite else {
            throw GraphQLCacheError.invalidConfiguration(
                "the combined freshness and stale interval must be finite"
            )
        }
        guard maximumTotalBytes > 0 else {
            throw GraphQLCacheError.invalidConfiguration("maximumTotalBytes must be greater than zero")
        }
        guard maximumEntryBytes > 0 else {
            throw GraphQLCacheError.invalidConfiguration("maximumEntryBytes must be greater than zero")
        }
        guard maximumEntryBytes <= maximumTotalBytes else {
            throw GraphQLCacheError.invalidConfiguration(
                "maximumEntryBytes cannot exceed maximumTotalBytes"
            )
        }
        guard maximumEntryBytes <= Int.max - GraphQLCacheEntryValidation.maximumEnvelopeOverheadBytes else {
            throw GraphQLCacheError.invalidConfiguration(
                "maximumEntryBytes leaves insufficient space for persistent cache envelope overhead"
            )
        }
        guard maximumEntries > 0 else {
            throw GraphQLCacheError.invalidConfiguration("maximumEntries must be greater than zero")
        }
        if let directoryURL, !directoryURL.isFileURL {
            throw GraphQLCacheError.invalidConfiguration("directoryURL must be a file URL")
        }
    }

    /// `age = max(0, now - lastSuccessfulWriteAt)`.
    public func age(now: Date, lastSuccessfulWriteAt: Date) -> TimeInterval {
        max(0, now.timeIntervalSince(lastSuccessfulWriteAt))
    }

    /// Freshness includes the exact TTL boundary.
    public func isFresh(age: TimeInterval) -> Bool {
        age <= freshnessTTL
    }

    /// Stale fallback excludes the fresh range and includes the combined upper
    /// boundary: `freshnessTTL < age <= freshnessTTL + staleIfErrorInterval`.
    public func isStaleEligible(age: TimeInterval) -> Bool {
        age > freshnessTTL && age <= freshnessTTL + staleIfErrorInterval
    }
}
