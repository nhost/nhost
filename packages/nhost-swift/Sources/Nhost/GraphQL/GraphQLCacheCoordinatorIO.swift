import Foundation

struct GraphQLCachedResponse<ResponseData: Decodable & Sendable>: Sendable {
    let response: NhostResponse<GraphQLResponse<ResponseData>>
    let entry: GraphQLCacheEntry
    let age: TimeInterval
    let isExpired: Bool
}

struct GraphQLNetworkResponse<ResponseData: Decodable & Sendable>: Sendable {
    let response: NhostResponse<GraphQLResponse<ResponseData>>
    let persistenceOutcome: GraphQLCachePersistenceOutcome
    let timestamp: Date
}

typealias GraphQLCacheSessionTransitionSubscriber = @Sendable (
    @escaping SessionTransitionObserver
) -> SessionStoreSubscription

struct GraphQLCacheClientScopeContext: Sendable {
    let defaultHeaders: [String: String]
    let configuredRole: String?
    let adminSession: AdminSessionOptions?
    let usesManagedSession: Bool
    let hasCustomMiddleware: Bool
    let sessionSnapshot: @Sendable () async throws -> SessionAuthorizationSnapshot?
    let subscribeToSessionTransitions: GraphQLCacheSessionTransitionSubscriber?

    init(
        defaultHeaders: [String: String],
        configuredRole: String?,
        adminSession: AdminSessionOptions?,
        usesManagedSession: Bool,
        hasCustomMiddleware: Bool,
        sessionSnapshot: @escaping @Sendable () async throws -> SessionAuthorizationSnapshot?,
        subscribeToSessionTransitions: GraphQLCacheSessionTransitionSubscriber? = nil
    ) {
        self.defaultHeaders = defaultHeaders
        self.configuredRole = configuredRole
        self.adminSession = adminSession
        self.usesManagedSession = usesManagedSession
        self.hasCustomMiddleware = hasCustomMiddleware
        self.sessionSnapshot = sessionSnapshot
        self.subscribeToSessionTransitions = subscribeToSessionTransitions
    }

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

/// Retains session transition observation and serializes best-effort deletion of
/// cache entries belonging to prior managed authorization scopes.
final class GraphQLCacheSessionHygiene: @unchecked Sendable {
    private struct Context: Sendable {
        let endpoint: URL
        let defaultHeaders: [String: String]
        let configuredRole: String?
        let adminSession: AdminSessionOptions?
        let diagnosticObserver: GraphQLCacheDiagnosticObserver?
    }

    private let lock = NSLock()
    private let store: any GraphQLCacheStore
    private let context: Context
    private var subscription: SessionStoreSubscription?
    private var pendingCleanup: Task<Void, Never>?

    private init(store: any GraphQLCacheStore, context: Context) {
        self.store = store
        self.context = context
    }

    static func configured(
        configuration: GraphQLCacheConfiguration,
        store: any GraphQLCacheStore,
        scopeContext: GraphQLCacheClientScopeContext,
        endpoint: URL
    ) -> GraphQLCacheSessionHygiene? {
        guard configuration.purgePreviousScopeOnSignOut,
              scopeContext.usesManagedSession,
              let subscribe = scopeContext.subscribeToSessionTransitions
        else {
            return nil
        }

        let hygiene = GraphQLCacheSessionHygiene(
            store: store,
            context: Context(
                endpoint: endpoint,
                defaultHeaders: scopeContext.defaultHeaders,
                configuredRole: scopeContext.configuredRole,
                adminSession: scopeContext.adminSession,
                diagnosticObserver: configuration.diagnosticObserver
            )
        )
        let subscription = subscribe { [weak hygiene] old, new in
            hygiene?.enqueue(old: old, new: new)
        }
        hygiene.retain(subscription)
        return hygiene
    }

    deinit {
        subscription?.cancelImmediately()
    }

    func retain(_ subscription: SessionStoreSubscription) {
        lock.lock()
        self.subscription = subscription
        lock.unlock()
    }

    /// Called by `SessionStore` while notifying transitions. This method only
    /// appends work to an ordered task chain and never waits for store I/O.
    func enqueue(old: StoredSession?, new: StoredSession?) {
        guard let old,
              old.stableAuthorizationFingerprint != new?.stableAuthorizationFingerprint
        else {
            return
        }

        lock.lock()
        let previous = pendingCleanup
        let store = self.store
        let context = self.context
        let task = Task {
            await previous?.value
            await Self.purge(old: old, store: store, context: context)
        }
        pendingCleanup = task
        lock.unlock()
    }

    /// Cache-enabled operations wait for already-enqueued deletion so a delayed
    /// old-user purge cannot remove a newly written response for the new scope.
    func waitForPendingCleanup() async {
        let task = lock.withLock { pendingCleanup }
        await task?.value
    }

    private static func purge(
        old: StoredSession,
        store: any GraphQLCacheStore,
        context: Context
    ) async {
        let snapshot = SessionAuthorizationSnapshot(
            session: old,
            mutationGeneration: 0,
            authorizationEpoch: 0,
            stableFingerprint: old.stableAuthorizationFingerprint
        )
        let previousScope: GraphQLCacheDigest?
        do {
            previousScope = try await GraphQLCacheScopeInputs(
                endpoint: context.endpoint,
                request: GraphQLRequest(query: "query NhostCacheCleanup { __typename }"),
                defaultHeaders: context.defaultHeaders,
                configuredRole: context.configuredRole,
                adminSession: context.adminSession,
                sessionSnapshot: snapshot,
                usesManagedSession: true
            ).resolve()?.digest
        } catch {
            previousScope = nil
            diagnose(context.diagnosticObserver)
        }

        if let previousScope {
            await invalidate(
                GraphQLCacheStoreFilter(authorizationScope: previousScope),
                store: store,
                diagnosticObserver: context.diagnosticObserver
            )
        }
        if let userIdentity = old.stableUserIdentity {
            // A request-specific resolver may augment the stored authorization digest,
            // but cannot be re-run after that request during sign-out. The managed-user
            // facet is therefore an intentional, broader hygiene fallback that removes
            // every cached scope for the old user; key isolation never depends on purge.
            await invalidate(
                GraphQLCacheStoreFilter(
                    userIdentity: GraphQLCacheKeyBuilder.facetDigest(
                        domain: "user",
                        value: userIdentity
                    )
                ),
                store: store,
                diagnosticObserver: context.diagnosticObserver
            )
        }
    }

    private static func invalidate(
        _ filter: GraphQLCacheStoreFilter,
        store: any GraphQLCacheStore,
        diagnosticObserver: GraphQLCacheDiagnosticObserver?
    ) async {
        do {
            _ = try await store.invalidate(filter)
        } catch {
            diagnose(diagnosticObserver)
        }
    }

    private static func diagnose(_ observer: GraphQLCacheDiagnosticObserver?) {
        observer?(
            GraphQLCacheDiagnostic(
                kind: .cleanupFailure,
                message: "a previous GraphQL cache authorization scope could not be removed"
            )
        )
    }
}

extension GraphQLCacheCoordinator {
    func readCachedResponse<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        prepared: PreparedRequest,
        decoder: @Sendable () -> JSONDecoder,
        requirement: CacheReadRequirement
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        try await cachedResponse(
            responseType,
            prepared: prepared,
            decoder: decoder,
            requirement: requirement
        ).response
    }

    func cachedResponse<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        prepared: PreparedRequest,
        decoder: @Sendable () -> JSONDecoder,
        requirement: CacheReadRequirement
    ) async throws -> GraphQLCachedResponse<ResponseData> {
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
        }
        try await verifyCurrentScope(prepared.scope)
        try Task.checkCancellation()
        return GraphQLCachedResponse(
            response: response,
            entry: rawEntry,
            age: age,
            isExpired: !configuration.isFresh(age: age)
        )
    }

    func networkResponse<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        decoder: @Sendable () -> JSONDecoder,
        prepared: PreparedRequest
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        try await refreshedResponse(
            responseType,
            graphQLRequest: graphQLRequest,
            headers: headers,
            decoder: decoder,
            prepared: prepared
        ).response
    }

    func refreshedResponse<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        decoder: @Sendable () -> JSONDecoder,
        prepared: PreparedRequest
    ) async throws -> GraphQLNetworkResponse<ResponseData> {
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

        do {
            guard try await canAssociate(
                captured,
                expectedBody: encoded.body,
                scope: prepared.scope
            ) else {
                return GraphQLNetworkResponse(
                    response: response,
                    persistenceOutcome: .skipped,
                    timestamp: clock()
                )
            }
        } catch GraphQLCacheError.unavailableScope {
            return GraphQLNetworkResponse(
                response: response,
                persistenceOutcome: .skipped,
                timestamp: clock()
            )
        }
        try Task.checkCancellation()
        guard captured.response.isSuccess else {
            return GraphQLNetworkResponse(
                response: response,
                persistenceOutcome: .skipped,
                timestamp: clock()
            )
        }
        guard captured.response.body.count <= configuration.maximumEntryBytes else {
            diagnose(.oversizedEntry, "a GraphQL response exceeded the configured cache entry limit")
            return GraphQLNetworkResponse(
                response: response,
                persistenceOutcome: .skipped,
                timestamp: clock()
            )
        }

        let now = clock()
        let entry = cacheEntry(from: captured, identity: prepared.identity, at: now)
        var persistenceOutcome = GraphQLCachePersistenceOutcome.stored
        do {
            try await verifyCurrentScope(prepared.scope)
            try Task.checkCancellation()
            try await store.write(entry, for: prepared.identity.key)
        } catch is CancellationError {
            throw CancellationError()
        } catch GraphQLCacheError.authorizationScopeChanged {
            throw GraphQLCacheError.authorizationScopeChanged
        } catch GraphQLCacheError.unavailableScope {
            return GraphQLNetworkResponse(
                response: response,
                persistenceOutcome: .skipped,
                timestamp: now
            )
        } catch let GraphQLCacheError.oversizedEntry(actual, maximum) {
            diagnose(.oversizedEntry, "a GraphQL response exceeded the configured cache entry limit")
            _ = (actual, maximum)
            persistenceOutcome = .skipped
        } catch {
            diagnose(.storeWriteFailure, "a GraphQL response could not be cached")
            persistenceOutcome = .failedAndReported
        }

        do {
            try await verifyCurrentScope(prepared.scope)
        } catch GraphQLCacheError.authorizationScopeChanged {
            try? await store.removeEntry(for: prepared.identity.key)
            throw GraphQLCacheError.authorizationScopeChanged
        } catch GraphQLCacheError.unavailableScope {
            if persistenceOutcome == .stored {
                do {
                    try await store.removeEntry(for: prepared.identity.key)
                } catch {
                    diagnose(.storeWriteFailure, "an unverified GraphQL cache entry could not be removed")
                }
                persistenceOutcome = .skipped
            }
        }
        try Task.checkCancellation()
        return GraphQLNetworkResponse(
            response: response,
            persistenceOutcome: persistenceOutcome,
            timestamp: now
        )
    }

    private func canAssociate(
        _ captured: NhostCapturedFetchResult,
        expectedBody: Data,
        scope: GraphQLCachePreflightScope
    ) async throws -> Bool {
        do {
            switch try scope.verifyTerminalRequest(
                transcript: captured.transcript,
                expectedURL: endpoint,
                expectedBody: expectedBody
            ) {
            case .unverifiable:
                diagnose(.unverifiableRequest, "the final GraphQL request could not be associated with the cache")
                return false
            case .verified:
                break
            }
        } catch GraphQLCacheError.authorizationScopeChanged {
            diagnose(
                .protectedRequestStateChanged,
                "the final protected GraphQL request state differed from its preflight scope"
            )
            throw GraphQLCacheError.authorizationScopeChanged
        }
        try await verifyCurrentScope(scope)
        return true
    }

    func verifyCurrentScope(_ scope: GraphQLCachePreflightScope) async throws {
        let snapshot = try await currentSnapshotForVerification()
        do {
            try scope.verifyCurrentSessionSnapshot(snapshot)
        } catch GraphQLCacheError.authorizationScopeChanged {
            diagnose(
                .sessionAuthorizationChanged,
                "the managed GraphQL authorization scope changed while work was in progress"
            )
            throw GraphQLCacheError.authorizationScopeChanged
        }
    }

    private func currentSnapshotForVerification() async throws -> SessionAuthorizationSnapshot? {
        do {
            return try await scopeContext.sessionSnapshot()
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            diagnose(
                .unavailableScope,
                "the current GraphQL authorization scope could not be verified"
            )
            throw GraphQLCacheError.unavailableScope
        }
    }

    private func cacheEntry(
        from captured: NhostCapturedFetchResult,
        identity: GraphQLCacheIdentity,
        at date: Date
    ) -> GraphQLCacheEntry {
        GraphQLCacheEntry(
            key: identity.key,
            body: captured.response.body,
            status: captured.response.status,
            contentType: GraphQLCacheEntryValidation.sanitizedContentType(
                NhostHeaderLookup.value(in: captured.response.headers, named: "content-type")
            ),
            createdAt: date,
            lastSuccessfulWriteAt: date,
            lastAccessedAt: date,
            facets: identity.facets
        )
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
        case .unavailableScope:
            break
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
