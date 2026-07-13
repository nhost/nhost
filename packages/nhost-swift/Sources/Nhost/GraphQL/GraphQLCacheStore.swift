import Foundation

/// Opaque SHA-256 material handed to a custom store. Raw cache inputs cannot be
/// recovered from this value.
public struct GraphQLCacheDigest: Codable, Sendable, Hashable {
    public let rawValue: String
}

/// Opaque storage key generated from every protected cache-key dimension.
public struct GraphQLCacheKey: Codable, Sendable, Hashable {
    public let rawValue: String
}

/// Hashed facets used by stores for composable invalidation. Values are opaque
/// and contain no raw endpoint, user, operation, namespace, or tag text.
public struct GraphQLCacheEntryFacets: Codable, Sendable, Equatable {
    public let endpoint: GraphQLCacheDigest
    public let authorizationScope: GraphQLCacheDigest
    public let userIdentity: GraphQLCacheDigest?
    public let operationName: GraphQLCacheDigest?
    public let namespace: GraphQLCacheDigest?
    public let tags: Set<GraphQLCacheDigest>
}

/// Raw, already-protected cache value exchanged with a cache store.
public struct GraphQLCacheEntry: Codable, Sendable, Equatable {
    public let key: GraphQLCacheKey
    public let body: Data
    public let status: Int
    public let contentType: String?
    public let createdAt: Date
    public let lastSuccessfulWriteAt: Date
    public let lastAccessedAt: Date
    public let facets: GraphQLCacheEntryFacets
}

/// Store-level filter containing only SDK-generated opaque facets.
public struct GraphQLCacheStoreFilter: Sendable, Equatable {
    public let endpoint: GraphQLCacheDigest?
    public let authorizationScope: GraphQLCacheDigest?
    public let userIdentity: GraphQLCacheDigest?
    public let operationName: GraphQLCacheDigest?
    public let namespace: GraphQLCacheDigest?
    public let tag: GraphQLCacheDigest?
    public let createdAtOrBefore: Date?
    public let lastSuccessfulWriteAtOrBefore: Date?

    init(
        endpoint: GraphQLCacheDigest? = nil,
        authorizationScope: GraphQLCacheDigest? = nil,
        userIdentity: GraphQLCacheDigest? = nil,
        operationName: GraphQLCacheDigest? = nil,
        namespace: GraphQLCacheDigest? = nil,
        tag: GraphQLCacheDigest? = nil,
        createdAtOrBefore: Date? = nil,
        lastSuccessfulWriteAtOrBefore: Date? = nil
    ) {
        self.endpoint = endpoint
        self.authorizationScope = authorizationScope
        self.userIdentity = userIdentity
        self.operationName = operationName
        self.namespace = namespace
        self.tag = tag
        self.createdAtOrBefore = createdAtOrBefore
        self.lastSuccessfulWriteAtOrBefore = lastSuccessfulWriteAtOrBefore
    }
}

/// Concurrency-safe raw-response cache contract. Implementations receive only
/// opaque SDK-generated keys and hashed facets. The SDK revalidates custom-store
/// entries before decoding them.
public protocol GraphQLCacheStore: Sendable {
    func entry(for key: GraphQLCacheKey) async throws -> GraphQLCacheEntry?
    func write(_ entry: GraphQLCacheEntry, for key: GraphQLCacheKey) async throws
    func removeEntry(for key: GraphQLCacheKey) async throws
    func touchEntry(for key: GraphQLCacheKey, at date: Date) async throws
    @discardableResult
    func invalidate(_ filter: GraphQLCacheStoreFilter) async throws -> Int
    func prune() async throws
}
