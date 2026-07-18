import Foundation

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
    let sessionHygiene: GraphQLCacheSessionHygiene?
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
}

extension GraphQLCacheCoordinator {
    func staleWhileRevalidate<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        decoder: @escaping @Sendable () -> JSONDecoder,
        options: GraphQLCacheRequestOptions,
        legacyFetch: @escaping FetchFunction
    ) -> AsyncThrowingStream<GraphQLCacheResult<ResponseData>, Error> {
        AsyncThrowingStream { continuation in
            let producer = Task {
                do {
                    try await produceStaleWhileRevalidate(
                        responseType,
                        graphQLRequest: graphQLRequest,
                        headers: headers,
                        decoder: decoder,
                        options: options,
                        legacyFetch: legacyFetch,
                        continuation: continuation
                    )
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { @Sendable _ in
                producer.cancel()
            }
        }
    }

    private func produceStaleWhileRevalidate<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        decoder: @Sendable () -> JSONDecoder,
        options: GraphQLCacheRequestOptions,
        legacyFetch: FetchFunction,
        continuation: AsyncThrowingStream<GraphQLCacheResult<ResponseData>, Error>.Continuation
    ) async throws {
        let prepared: PreparedRequest
        do {
            prepared = try await prepare(
                graphQLRequest: graphQLRequest,
                headers: headers,
                options: options
            )
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as GraphQLCacheError where error == .ineligibleOperation {
            try await yieldLegacyFresh(
                responseType,
                graphQLRequest: graphQLRequest,
                headers: headers,
                decoder: decoder,
                legacyFetch: legacyFetch,
                persistenceOutcome: .notAttempted,
                continuation: continuation
            )
            return
        } catch {
            diagnosePreparation(error)
            try await yieldLegacyFresh(
                responseType,
                graphQLRequest: graphQLRequest,
                headers: headers,
                decoder: decoder,
                legacyFetch: legacyFetch,
                persistenceOutcome: .failedAndReported,
                continuation: continuation
            )
            return
        }

        var cached: GraphQLCachedResponse<ResponseData>?
        do {
            let candidate = try await cachedResponse(
                responseType,
                prepared: prepared,
                decoder: decoder,
                requirement: .freshOrStale
            )
            try Task.checkCancellation()
            let yieldResult = continuation.yield(
                .cached(candidate.response, metadata: cachedMetadata(candidate))
            )
            if case .terminated = yieldResult { return }
            cached = candidate
        } catch is CancellationError {
            throw CancellationError()
        } catch GraphQLCacheError.authorizationScopeChanged {
            throw GraphQLCacheError.authorizationScopeChanged
        } catch {
            diagnoseReadRecovery(error)
        }

        try Task.checkCancellation()
        let refreshed = try await refreshedResponse(
            responseType,
            graphQLRequest: graphQLRequest,
            headers: headers,
            decoder: decoder,
            prepared: prepared
        )
        try Task.checkCancellation()
        let createdAt = refreshed.persistenceOutcome == .stored
            ? cached?.entry.createdAt ?? refreshed.timestamp
            : refreshed.timestamp
        let yieldResult = continuation.yield(
            .fresh(
                refreshed.response,
                metadata: freshMetadata(
                    response: refreshed.response,
                    timestamp: refreshed.timestamp,
                    createdAt: createdAt,
                    persistenceOutcome: refreshed.persistenceOutcome
                )
            )
        )
        if case .terminated = yieldResult { return }
        continuation.finish()
    }

    private func yieldLegacyFresh<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        decoder: @Sendable () -> JSONDecoder,
        legacyFetch: FetchFunction,
        persistenceOutcome: GraphQLCachePersistenceOutcome,
        continuation: AsyncThrowingStream<GraphQLCacheResult<ResponseData>, Error>.Continuation
    ) async throws {
        let response = try await legacyResponse(
            responseType,
            graphQLRequest: graphQLRequest,
            headers: headers,
            decoder: decoder,
            legacyFetch: legacyFetch
        )
        try Task.checkCancellation()
        let timestamp = clock()
        _ = continuation.yield(
            .fresh(
                response,
                metadata: freshMetadata(
                    response: response,
                    timestamp: timestamp,
                    createdAt: timestamp,
                    persistenceOutcome: persistenceOutcome
                )
            )
        )
        continuation.finish()
    }

    private func cachedMetadata<ResponseData>(
        _ cached: GraphQLCachedResponse<ResponseData>
    ) -> GraphQLCacheMetadata where ResponseData: Decodable & Sendable {
        GraphQLCacheMetadata(
            source: .cached,
            createdAt: cached.entry.createdAt,
            lastSuccessfulWriteAt: cached.entry.lastSuccessfulWriteAt,
            age: cached.age,
            isExpired: cached.isExpired,
            status: cached.entry.status,
            persistenceOutcome: .notAttempted
        )
    }

    private func freshMetadata<ResponseData>(
        response: NhostResponse<GraphQLResponse<ResponseData>>,
        timestamp: Date,
        createdAt: Date,
        persistenceOutcome: GraphQLCachePersistenceOutcome
    ) -> GraphQLCacheMetadata where ResponseData: Decodable & Sendable {
        GraphQLCacheMetadata(
            source: .fresh,
            createdAt: createdAt,
            lastSuccessfulWriteAt: timestamp,
            age: 0,
            isExpired: false,
            status: response.status,
            persistenceOutcome: persistenceOutcome
        )
    }

    func currentAuthorizationScopeDigest() async throws -> GraphQLCacheDigest? {
        try await waitForSessionCleanup()
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

    func prepare(
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        options: GraphQLCacheRequestOptions
    ) async throws -> PreparedRequest {
        try await waitForSessionCleanup()
        try configuration.validate()
        let operation = try selectedQueryOperation(graphQLRequest)

        let snapshot = try await sessionSnapshotForPreparation()

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

    private func sessionSnapshotForPreparation() async throws -> SessionAuthorizationSnapshot? {
        do {
            return try await scopeContext.sessionSnapshot()
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw GraphQLCacheError.unavailableScope
        }
    }

    private func waitForSessionCleanup() async throws {
        await sessionHygiene?.waitForPendingCleanup()
        try Task.checkCancellation()
    }

    private func selectedQueryOperation(
        _ request: GraphQLRequest
    ) throws -> GraphQLSelectedOperation {
        guard let operation = GraphQLOperationClassifier.selectOperation(
            query: request.query,
            operationName: request.operationName
        ), operation.kind == .query else {
            throw GraphQLCacheError.ineligibleOperation
        }
        return operation
    }

    func recoverablePreparation(
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

extension GraphQLCacheCoordinator {
    func cacheOnlyResponse<ResponseData: Decodable & Sendable>(
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
            requirement: .fresh
        )
    }

    func cacheFirstResponse<ResponseData: Decodable & Sendable>(
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
                requirement: .fresh
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

    func networkFirstResponse<ResponseData: Decodable & Sendable>(
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
                requirement: .freshOrStale
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
}
