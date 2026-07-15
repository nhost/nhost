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

enum GraphQLCacheEntryValidation {
    static let maximumMetadataBytes = 64 * 1_024
    static let envelopeHeaderBytes = 8 + 2 + 4 + 8
    static let maximumEnvelopeOverheadBytes = maximumMetadataBytes + envelopeHeaderBytes
    static let maximumContentTypeBytes = 1_024
    static let maximumTags = 128

    static func validated(
        _ entry: GraphQLCacheEntry,
        requestedKey: GraphQLCacheKey,
        maximumEntryBytes: Int,
        sanitizeContentType: Bool
    ) throws -> GraphQLCacheEntry {
        guard entry.key == requestedKey, isDigest(requestedKey.rawValue) else {
            throw GraphQLCacheError.storeFailure("cache entry key validation failed")
        }
        guard (200 ... 299).contains(entry.status) else {
            throw GraphQLCacheError.storeFailure("cache entry status validation failed")
        }
        guard entry.body.count <= maximumEntryBytes else {
            throw GraphQLCacheError.oversizedEntry(
                actualBytes: entry.body.count,
                maximumBytes: maximumEntryBytes
            )
        }
        guard validDate(entry.createdAt),
              validDate(entry.lastSuccessfulWriteAt),
              validDate(entry.lastAccessedAt)
        else {
            throw GraphQLCacheError.storeFailure("cache entry timestamp validation failed")
        }
        guard validFacets(entry.facets) else {
            throw GraphQLCacheError.storeFailure("cache entry facet validation failed")
        }

        let contentType = sanitizedContentType(entry.contentType)
        if !sanitizeContentType, contentType != entry.contentType {
            throw GraphQLCacheError.storeFailure("cache entry content type validation failed")
        }

        return GraphQLCacheEntry(
            key: entry.key,
            body: entry.body,
            status: entry.status,
            contentType: contentType,
            createdAt: entry.createdAt,
            lastSuccessfulWriteAt: entry.lastSuccessfulWriteAt,
            lastAccessedAt: entry.lastAccessedAt,
            facets: entry.facets
        )
    }

    static func validatedCustomRead(
        _ entry: GraphQLCacheEntry,
        requestedKey: GraphQLCacheKey,
        expectedFacets: GraphQLCacheEntryFacets? = nil,
        maximumEntryBytes: Int
    ) throws -> GraphQLCacheEntry {
        let value = try validated(
            entry,
            requestedKey: requestedKey,
            maximumEntryBytes: maximumEntryBytes,
            sanitizeContentType: false
        )
        if let expectedFacets, value.facets != expectedFacets {
            throw GraphQLCacheError.storeFailure("cache entry facet association failed")
        }
        return value
    }

    static func sanitizedContentType(_ value: String?) -> String? {
        guard let value else { return nil }
        guard !value.isEmpty, value.utf8.count <= maximumContentTypeBytes else { return nil }
        guard value.unicodeScalars.allSatisfy({ scalar in
            scalar.value >= 0x20 && scalar.value != 0x7f
        }) else { return nil }

        guard let mediaType = value.split(separator: ";", maxSplits: 1, omittingEmptySubsequences: false)
            .first?
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased(),
            mediaType == "application/json" || mediaType == "application/graphql-response+json"
        else {
            return nil
        }
        return value
    }

    static func matches(_ entry: GraphQLCacheEntry, filter: GraphQLCacheStoreFilter) -> Bool {
        if let value = filter.endpoint, entry.facets.endpoint != value { return false }
        if let value = filter.authorizationScope, entry.facets.authorizationScope != value { return false }
        if let value = filter.userIdentity, entry.facets.userIdentity != value { return false }
        if let value = filter.operationName, entry.facets.operationName != value { return false }
        if let value = filter.namespace, entry.facets.namespace != value { return false }
        if let value = filter.tag, !entry.facets.tags.contains(value) { return false }
        if let cutoff = filter.createdAtOrBefore, entry.createdAt > cutoff { return false }
        if let cutoff = filter.lastSuccessfulWriteAtOrBefore,
           entry.lastSuccessfulWriteAt > cutoff {
            return false
        }
        return true
    }

    static func isDigest(_ value: String) -> Bool {
        value.utf8.count == 64 && value.utf8.allSatisfy { byte in
            (48 ... 57).contains(byte) || (97 ... 102).contains(byte)
        }
    }

    private static func validDate(_ date: Date) -> Bool {
        date.timeIntervalSinceReferenceDate.isFinite
    }

    private static func validFacets(_ facets: GraphQLCacheEntryFacets) -> Bool {
        guard isDigest(facets.endpoint.rawValue),
              isDigest(facets.authorizationScope.rawValue),
              facets.tags.count <= maximumTags
        else {
            return false
        }
        let optional = [
            facets.userIdentity,
            facets.operationName,
            facets.namespace
        ]
        return optional.allSatisfy { $0.map { isDigest($0.rawValue) } ?? true }
            && facets.tags.allSatisfy { isDigest($0.rawValue) }
    }
}

/// Deterministic actor-isolated store useful for tests and applications that do
/// not need persistence. It applies the same validation, overwrite, limit, LRU,
/// and invalidation rules as the default file store.
public actor MemoryGraphQLCacheStore: GraphQLCacheStore {
    private let maximumTotalBytes: Int
    private let maximumEntryBytes: Int
    private let maximumEntries: Int
    private var entries: [GraphQLCacheKey: GraphQLCacheEntry] = [:]

    public init(
        maximumTotalBytes: Int = GraphQLCacheConfiguration.defaultMaximumTotalBytes,
        maximumEntryBytes: Int = GraphQLCacheConfiguration.defaultMaximumEntryBytes,
        maximumEntries: Int = GraphQLCacheConfiguration.defaultMaximumEntries
    ) {
        self.maximumTotalBytes = maximumTotalBytes
        self.maximumEntryBytes = maximumEntryBytes
        self.maximumEntries = maximumEntries
    }

    public func entry(for key: GraphQLCacheKey) throws -> GraphQLCacheEntry? {
        guard let entry = entries[key] else { return nil }
        return try GraphQLCacheEntryValidation.validatedCustomRead(
            entry,
            requestedKey: key,
            maximumEntryBytes: maximumEntryBytes
        )
    }

    public func write(_ entry: GraphQLCacheEntry, for key: GraphQLCacheKey) throws {
        var value = try GraphQLCacheEntryValidation.validated(
            entry,
            requestedKey: key,
            maximumEntryBytes: maximumEntryBytes,
            sanitizeContentType: true
        )
        if let existing = entries[key] {
            value = GraphQLCacheEntry(
                key: value.key,
                body: value.body,
                status: value.status,
                contentType: value.contentType,
                createdAt: existing.createdAt,
                lastSuccessfulWriteAt: value.lastSuccessfulWriteAt,
                lastAccessedAt: value.lastAccessedAt,
                facets: value.facets
            )
        }
        entries[key] = value
        pruneEntries()
    }

    public func removeEntry(for key: GraphQLCacheKey) {
        entries.removeValue(forKey: key)
    }

    public func touchEntry(for key: GraphQLCacheKey, at date: Date) throws {
        guard let entry = entries[key] else { return }
        guard date.timeIntervalSinceReferenceDate.isFinite else {
            throw GraphQLCacheError.storeFailure("cache touch timestamp validation failed")
        }
        entries[key] = GraphQLCacheEntry(
            key: entry.key,
            body: entry.body,
            status: entry.status,
            contentType: entry.contentType,
            createdAt: entry.createdAt,
            lastSuccessfulWriteAt: entry.lastSuccessfulWriteAt,
            lastAccessedAt: date,
            facets: entry.facets
        )
    }

    @discardableResult
    public func invalidate(_ filter: GraphQLCacheStoreFilter) -> Int {
        let keys = entries.compactMap { key, entry in
            GraphQLCacheEntryValidation.matches(entry, filter: filter) ? key : nil
        }
        for key in keys {
            entries.removeValue(forKey: key)
        }
        return keys.count
    }

    public func prune() {
        pruneEntries()
    }

    private func pruneEntries() {
        while entries.count > maximumEntries
            || entries.values.reduce(0, { $0 + $1.body.count }) > maximumTotalBytes {
            guard let oldest = entries.values.min(by: lruPrecedes) else { return }
            entries.removeValue(forKey: oldest.key)
        }
    }

    private func lruPrecedes(_ lhs: GraphQLCacheEntry, _ rhs: GraphQLCacheEntry) -> Bool {
        if lhs.lastAccessedAt != rhs.lastAccessedAt {
            return lhs.lastAccessedAt < rhs.lastAccessedAt
        }
        return lhs.key.rawValue < rhs.key.rawValue
    }
}
