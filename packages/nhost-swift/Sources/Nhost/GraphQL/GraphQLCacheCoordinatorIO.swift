import Foundation

extension GraphQLCacheCoordinator {
    func readCachedResponse<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        prepared: PreparedRequest,
        decoder: @Sendable () -> JSONDecoder,
        requirement: CacheReadRequirement,
        touchFailureIsFatal: Bool
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        try Task.checkCancellation()
        let rawEntry: GraphQLCacheEntry
        do {
            guard let value = try await store.entry(for: prepared.identity.key) else {
                throw GraphQLCacheError.miss
            }
            rawEntry = try GraphQLCacheEntryValidation.validatedCustomRead(
                value,
                requestedKey: prepared.identity.key,
                expectedFacets: prepared.identity.facets,
                maximumEntryBytes: configuration.maximumEntryBytes
            )
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as GraphQLCacheError {
            throw error
        } catch {
            throw GraphQLCacheError.storeFailure("cache read failed")
        }

        let now = clock()
        let rawAge = now.timeIntervalSince(rawEntry.lastSuccessfulWriteAt)
        if rawAge < 0 {
            diagnose(.clockRollback, "the cache clock moved backwards")
        }
        let age = configuration.age(now: now, lastSuccessfulWriteAt: rawEntry.lastSuccessfulWriteAt)
        switch requirement {
        case .fresh:
            guard configuration.isFresh(age: age) else {
                throw GraphQLCacheError.expired
            }
        case .freshOrStale:
            guard configuration.isFresh(age: age) || configuration.isStaleEligible(age: age) else {
                throw GraphQLCacheError.expired
            }
        }

        let response: NhostResponse<GraphQLResponse<ResponseData>>
        do {
            response = try GraphQLClient.decodeResponse(
                responseType,
                from: NhostRawResponse(
                    status: rawEntry.status,
                    headers: rawEntry.contentType.map { ["content-type": $0] } ?? [:],
                    body: rawEntry.body
                ),
                decoder: decoder
            )
        } catch {
            do {
                try await store.removeEntry(for: prepared.identity.key)
            } catch {
                diagnose(.storeWriteFailure, "an incompatible cache entry could not be removed")
            }
            throw GraphQLCacheError.decoderIncompatible
        }

        try await verifyCurrentScope(prepared.scope)
        do {
            try await store.touchEntry(for: prepared.identity.key, at: now)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            diagnose(.storeTouchFailure, "a GraphQL cache entry could not be touched")
            if touchFailureIsFatal {
                throw sanitizedStoreError(error)
            }
        }
        try await verifyCurrentScope(prepared.scope)
        try Task.checkCancellation()
        return response
    }

    func networkResponse<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        decoder: @Sendable () -> JSONDecoder,
        prepared: PreparedRequest
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        let encoded = try GraphQLClient.encodedRequest(
            url: endpoint,
            graphQLRequest: graphQLRequest,
            headers: headers
        )
        let captured = try await executor.execute(encoded.request)
        let response = try GraphQLClient.decodeResponse(
            responseType,
            from: captured.response,
            decoder: decoder
        )

        let currentSnapshot = try await currentSnapshotForVerification()
        switch try prepared.scope.verify(
            transcript: captured.transcript,
            expectedURL: endpoint,
            expectedBody: encoded.body,
            currentSessionSnapshot: currentSnapshot
        ) {
        case .unverifiable:
            diagnose(.unverifiableRequest, "the final GraphQL request could not be associated with the cache")
            return response
        case .verified:
            break
        }

        try Task.checkCancellation()
        guard captured.response.isSuccess else { return response }
        guard captured.response.body.count <= configuration.maximumEntryBytes else {
            diagnose(.oversizedEntry, "a GraphQL response exceeded the configured cache entry limit")
            return response
        }

        let now = clock()
        let entry = GraphQLCacheEntry(
            key: prepared.identity.key,
            body: captured.response.body,
            status: captured.response.status,
            contentType: GraphQLCacheEntryValidation.sanitizedContentType(
                NhostHeaderLookup.value(in: captured.response.headers, named: "content-type")
            ),
            createdAt: now,
            lastSuccessfulWriteAt: now,
            lastAccessedAt: now,
            facets: prepared.identity.facets
        )
        do {
            try await verifyCurrentScope(prepared.scope)
            try Task.checkCancellation()
            try await store.write(entry, for: prepared.identity.key)
        } catch is CancellationError {
            throw CancellationError()
        } catch GraphQLCacheError.authorizationScopeChanged {
            throw GraphQLCacheError.authorizationScopeChanged
        } catch let GraphQLCacheError.oversizedEntry(actual, maximum) {
            diagnose(.oversizedEntry, "a GraphQL response exceeded the configured cache entry limit")
            _ = (actual, maximum)
        } catch {
            diagnose(.storeWriteFailure, "a GraphQL response could not be cached")
        }

        do {
            try await verifyCurrentScope(prepared.scope)
        } catch GraphQLCacheError.authorizationScopeChanged {
            try? await store.removeEntry(for: prepared.identity.key)
            throw GraphQLCacheError.authorizationScopeChanged
        }
        try Task.checkCancellation()
        return response
    }

    private func verifyCurrentScope(_ scope: GraphQLCachePreflightScope) async throws {
        let snapshot = try await currentSnapshotForVerification()
        try scope.verifyCurrentSessionSnapshot(snapshot)
    }

    private func currentSnapshotForVerification() async throws -> SessionAuthorizationSnapshot? {
        do {
            return try await scopeContext.sessionSnapshot()
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw GraphQLCacheError.authorizationScopeChanged
        }
    }

    private func sanitizedStoreError(_ error: Error) -> Error {
        if let cacheError = error as? GraphQLCacheError { return cacheError }
        return GraphQLCacheError.storeFailure("cache operation failed")
    }

    func diagnosePreparation(_ error: Error) {
        switch error as? GraphQLCacheError {
        case .invalidConfiguration:
            diagnose(.invalidConfiguration, "GraphQL cache configuration is invalid")
        case .unavailableScope:
            diagnose(.unavailableScope, "a protected GraphQL cache scope was unavailable")
        case .keyGenerationFailed:
            diagnose(.keyGenerationFailure, "a GraphQL cache key could not be generated")
        case .ineligibleOperation:
            break
        default:
            diagnose(.storeReadFailure, "GraphQL cache preparation failed")
        }
    }

    func diagnoseReadRecovery(_ error: Error) {
        switch error as? GraphQLCacheError {
        case .miss, .expired:
            break
        case .decoderIncompatible:
            diagnose(.decoderIncompatible, "a cached GraphQL response was incompatible")
        case .oversizedEntry:
            diagnose(.oversizedEntry, "a cached GraphQL response exceeded its configured limit")
        default:
            diagnose(.storeReadFailure, "a GraphQL cache read failed")
        }
    }

    private func diagnose(_ kind: GraphQLCacheDiagnosticKind, _ message: String) {
        configuration.diagnosticObserver?(GraphQLCacheDiagnostic(kind: kind, message: message))
    }
}
