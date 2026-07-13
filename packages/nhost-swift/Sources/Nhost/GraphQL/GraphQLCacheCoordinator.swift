import Foundation

struct GraphQLCacheClientScopeContext: Sendable {
    let defaultHeaders: [String: String]
    let configuredRole: String?
    let adminSession: AdminSessionOptions?
    let usesManagedSession: Bool
    let hasCustomMiddleware: Bool
    let sessionSnapshot: @Sendable () async throws -> SessionAuthorizationSnapshot?

    static func standalone(hasCustomMiddleware: Bool) -> GraphQLCacheClientScopeContext {
        GraphQLCacheClientScopeContext(
            defaultHeaders: [:],
            configuredRole: nil,
            adminSession: nil,
            usesManagedSession: false,
            hasCustomMiddleware: hasCustomMiddleware,
            sessionSnapshot: { nil }
        )
    }
}

struct GraphQLCacheCoordinator: Sendable {
    struct PreparedRequest: Sendable {
        let scope: GraphQLCachePreflightScope
        let identity: GraphQLCacheIdentity
    }

    enum CacheReadRequirement {
        case fresh
        case freshOrStale
    }

    let configuration: GraphQLCacheConfiguration
    let store: any GraphQLCacheStore
    let executor: NhostContextualFetchExecutor
    let scopeContext: GraphQLCacheClientScopeContext
    let clock: @Sendable () -> Date
    let endpoint: URL
}

extension GraphQLCacheCoordinator {
    func request<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        decoder: @Sendable () -> JSONDecoder,
        cacheOptions: GraphQLCacheRequestOptions,
        legacyFetch: FetchFunction
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        switch cacheOptions.policy {
        case .networkOnly:
            return try await legacyResponse(
                responseType,
                graphQLRequest: graphQLRequest,
                headers: headers,
                decoder: decoder,
                legacyFetch: legacyFetch
            )
        case .cacheOnly:
            return try await cacheOnlyResponse(
                responseType,
                graphQLRequest: graphQLRequest,
                headers: headers,
                decoder: decoder,
                options: cacheOptions
            )
        case .cacheFirst:
            return try await cacheFirstResponse(
                responseType,
                graphQLRequest: graphQLRequest,
                headers: headers,
                decoder: decoder,
                options: cacheOptions,
                legacyFetch: legacyFetch
            )
        case .networkFirst:
            return try await networkFirstResponse(
                responseType,
                graphQLRequest: graphQLRequest,
                headers: headers,
                decoder: decoder,
                options: cacheOptions,
                legacyFetch: legacyFetch
            )
        }
    }

    private func cacheOnlyResponse<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        decoder: @Sendable () -> JSONDecoder,
        options: GraphQLCacheRequestOptions
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        let prepared = try await prepare(
            graphQLRequest: graphQLRequest,
            headers: headers,
            options: options
        )
        return try await readCachedResponse(
            responseType,
            prepared: prepared,
            decoder: decoder,
            requirement: .fresh,
            touchFailureIsFatal: true
        )
    }

    private func cacheFirstResponse<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        decoder: @Sendable () -> JSONDecoder,
        options: GraphQLCacheRequestOptions,
        legacyFetch: FetchFunction
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        guard let prepared = try await recoverablePreparation(
            graphQLRequest: graphQLRequest,
            headers: headers,
            options: options
        ) else {
            return try await legacyResponse(
                responseType,
                graphQLRequest: graphQLRequest,
                headers: headers,
                decoder: decoder,
                legacyFetch: legacyFetch
            )
        }
        do {
            return try await readCachedResponse(
                responseType,
                prepared: prepared,
                decoder: decoder,
                requirement: .fresh,
                touchFailureIsFatal: true
            )
        } catch is CancellationError {
            throw CancellationError()
        } catch GraphQLCacheError.authorizationScopeChanged {
            throw GraphQLCacheError.authorizationScopeChanged
        } catch {
            diagnoseReadRecovery(error)
            return try await networkResponse(
                responseType,
                graphQLRequest: graphQLRequest,
                headers: headers,
                decoder: decoder,
                prepared: prepared
            )
        }
    }

    private func networkFirstResponse<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        decoder: @Sendable () -> JSONDecoder,
        options: GraphQLCacheRequestOptions,
        legacyFetch: FetchFunction
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        guard let prepared = try await recoverablePreparation(
            graphQLRequest: graphQLRequest,
            headers: headers,
            options: options
        ) else {
            return try await legacyResponse(
                responseType,
                graphQLRequest: graphQLRequest,
                headers: headers,
                decoder: decoder,
                legacyFetch: legacyFetch
            )
        }
        do {
            return try await networkResponse(
                responseType,
                graphQLRequest: graphQLRequest,
                headers: headers,
                decoder: decoder,
                prepared: prepared
            )
        } catch let error as FetchError {
            guard case .transport = error else { throw error }
            return try await networkFirstFallback(
                responseType,
                prepared: prepared,
                decoder: decoder,
                transportError: error
            )
        }
    }

    private func networkFirstFallback<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        prepared: PreparedRequest,
        decoder: @Sendable () -> JSONDecoder,
        transportError: FetchError
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        do {
            return try await readCachedResponse(
                responseType,
                prepared: prepared,
                decoder: decoder,
                requirement: .freshOrStale,
                touchFailureIsFatal: true
            )
        } catch is CancellationError {
            throw CancellationError()
        } catch GraphQLCacheError.authorizationScopeChanged {
            throw GraphQLCacheError.authorizationScopeChanged
        } catch {
            diagnoseReadRecovery(error)
            throw transportError
        }
    }

    private func legacyResponse<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        decoder: @Sendable () -> JSONDecoder,
        legacyFetch: FetchFunction
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        try await GraphQLClient.legacyRequest(
            responseType,
            url: endpoint,
            graphQLRequest: graphQLRequest,
            headers: headers,
            decoder: decoder,
            fetch: legacyFetch
        )
    }

    func currentAuthorizationScopeDigest() async throws -> GraphQLCacheDigest? {
        try configuration.validate()
        let request = GraphQLRequest(query: "query NhostCacheScope { __typename }")
        let snapshot = try await scopeContext.sessionSnapshot()
        let scope = try await GraphQLCacheScopeInputs(
            endpoint: endpoint,
            request: request,
            defaultHeaders: scopeContext.defaultHeaders,
            configuredRole: scopeContext.configuredRole,
            adminSession: scopeContext.adminSession,
            sessionSnapshot: snapshot,
            usesManagedSession: scopeContext.usesManagedSession,
            hasCustomMiddleware: scopeContext.hasCustomMiddleware
        ).resolve(resolver: configuration.scopeResolver)
        return scope?.digest
    }

    private func prepare(
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        options: GraphQLCacheRequestOptions
    ) async throws -> PreparedRequest {
        try configuration.validate()
        guard let operation = GraphQLOperationClassifier.selectOperation(
            query: graphQLRequest.query,
            operationName: graphQLRequest.operationName
        ), operation.kind == .query else {
            throw GraphQLCacheError.ineligibleOperation
        }

        let snapshot: SessionAuthorizationSnapshot?
        do {
            snapshot = try await scopeContext.sessionSnapshot()
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw GraphQLCacheError.unavailableScope
        }

        let scope: GraphQLCachePreflightScope
        do {
            guard let resolved = try await GraphQLCacheScopeInputs(
                endpoint: endpoint,
                request: graphQLRequest,
                requestHeaders: headers,
                defaultHeaders: scopeContext.defaultHeaders,
                configuredRole: scopeContext.configuredRole,
                adminSession: scopeContext.adminSession,
                sessionSnapshot: snapshot,
                usesManagedSession: scopeContext.usesManagedSession,
                hasCustomMiddleware: scopeContext.hasCustomMiddleware
            ).resolve(resolver: configuration.scopeResolver) else {
                throw GraphQLCacheError.unavailableScope
            }
            scope = resolved
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as GraphQLCacheError {
            throw error
        } catch {
            throw GraphQLCacheError.unavailableScope
        }

        do {
            return PreparedRequest(
                scope: scope,
                identity: try GraphQLCacheKeyBuilder.makeIdentity(
                    endpoint: endpoint,
                    operation: operation,
                    query: graphQLRequest.query,
                    variables: graphQLRequest.variables,
                    authorizationScope: scope.digest,
                    userIdentity: scope.userIdentity,
                    namespace: options.namespace,
                    tags: options.tags
                )
            )
        } catch {
            throw GraphQLCacheError.keyGenerationFailed
        }
    }

    private func recoverablePreparation(
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        options: GraphQLCacheRequestOptions
    ) async throws -> PreparedRequest? {
        do {
            return try await prepare(
                graphQLRequest: graphQLRequest,
                headers: headers,
                options: options
            )
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            diagnosePreparation(error)
            return nil
        }
    }

}
