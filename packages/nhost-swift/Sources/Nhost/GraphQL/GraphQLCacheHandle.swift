import Foundation

/// Explicit management facade for a GraphQL response cache. A disabled handle
/// fails with ``GraphQLCacheError/notConfigured`` and never initializes a store.
public struct GraphQLCacheHandle: Sendable {
    typealias FilterMapper = @Sendable (
        GraphQLCacheInvalidationFilter
    ) async throws -> GraphQLCacheStoreFilter

    private enum Backend: Sendable {
        case disabled
        case enabled(
            store: any GraphQLCacheStore,
            mapFilter: FilterMapper,
            diagnosticObserver: GraphQLCacheDiagnosticObserver?
        )
    }

    private let backend: Backend

    init() {
        backend = .disabled
    }

    init(
        store: any GraphQLCacheStore,
        currentAuthorizationScope: @escaping @Sendable () async throws -> GraphQLCacheDigest?,
        diagnosticObserver: GraphQLCacheDiagnosticObserver? = nil
    ) {
        backend = .enabled(
            store: store,
            mapFilter: { filter in
                try await Self.map(
                    filter,
                    currentAuthorizationScope: currentAuthorizationScope
                )
            },
            diagnosticObserver: diagnosticObserver
        )
    }

    /// Removes entries matching every non-nil filter field. An empty filter
    /// removes all entries. Explicit failures are reported and thrown.
    @discardableResult
    public func invalidate(
        _ filter: GraphQLCacheInvalidationFilter = GraphQLCacheInvalidationFilter()
    ) async throws -> Int {
        switch backend {
        case .disabled:
            throw GraphQLCacheError.notConfigured
        case let .enabled(store, mapFilter, observer):
            do {
                return try await store.invalidate(mapFilter(filter))
            } catch {
                observer?(
                    GraphQLCacheDiagnostic(
                        kind: .storeInvalidationFailure,
                        message: "explicit GraphQL cache invalidation failed"
                    )
                )
                throw sanitizedManagementError(error)
            }
        }
    }

    /// Applies configured count and byte limits immediately.
    public func prune() async throws {
        switch backend {
        case .disabled:
            throw GraphQLCacheError.notConfigured
        case let .enabled(store, _, observer):
            do {
                try await store.prune()
            } catch {
                observer?(
                    GraphQLCacheDiagnostic(
                        kind: .storePruneFailure,
                        message: "explicit GraphQL cache pruning failed"
                    )
                )
                throw sanitizedManagementError(error)
            }
        }
    }

    private func sanitizedManagementError(_ error: Error) -> Error {
        if let cacheError = error as? GraphQLCacheError { return cacheError }
        if error is CancellationError { return CancellationError() }
        return GraphQLCacheError.storeFailure("explicit cache management failed")
    }

    private static func map(
        _ filter: GraphQLCacheInvalidationFilter,
        currentAuthorizationScope: @Sendable () async throws -> GraphQLCacheDigest?
    ) async throws -> GraphQLCacheStoreFilter {
        let authorizationScope: GraphQLCacheDigest?
        let userIdentity: GraphQLCacheDigest?
        switch filter.scope {
        case nil:
            authorizationScope = nil
            userIdentity = nil
        case .current:
            guard let current = try await currentAuthorizationScope() else {
                throw GraphQLCacheError.unavailableScope
            }
            authorizationScope = current
            userIdentity = nil
        case let .user(identifier):
            authorizationScope = nil
            userIdentity = GraphQLCacheKeyBuilder.facetDigest(domain: "user", value: identifier)
        }

        return GraphQLCacheStoreFilter(
            endpoint: filter.endpoint.map {
                GraphQLCacheKeyBuilder.facetDigest(
                    domain: "endpoint",
                    value: GraphQLCacheKeyBuilder.canonicalEndpoint($0)
                )
            },
            authorizationScope: authorizationScope,
            userIdentity: userIdentity,
            operationName: filter.operationName.map {
                GraphQLCacheKeyBuilder.facetDigest(domain: "operation-name", value: $0)
            },
            namespace: filter.namespace.map {
                GraphQLCacheKeyBuilder.facetDigest(domain: "namespace", value: $0)
            },
            tag: filter.tag.map {
                GraphQLCacheKeyBuilder.facetDigest(domain: "tag", value: $0)
            },
            createdAtOrBefore: filter.createdAtOrBefore,
            lastSuccessfulWriteAtOrBefore: filter.lastSuccessfulWriteAtOrBefore
        )
    }
}
