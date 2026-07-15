import Foundation
import XCTest
@testable import Nhost

extension NhostClientGraphQLCacheTests {
    func testSignOutPasswordChangeAndClearSessionPurgePreviousManagedScope() async throws {
        let stored = try session(subject: "purged-user")
        let store = FactoryCacheStore()
        let transport = FactoryGraphQLTransport()
        let client = serverClient(session: stored, store: store, transport: transport)

        try await seed(client)
        _ = try await client.auth.signOut(body: AuthSignOutRequest())
        _ = try await client.sessionStore.set(stored)
        await assertCacheMiss(client)

        try await seed(client)
        _ = try await client.auth.changeUserPassword(
            body: AuthUserPasswordRequest(newPassword: "new-password")
        )
        _ = try await client.sessionStore.set(stored)
        await assertCacheMiss(client)

        try await seed(client)
        try await client.clearSession()
        _ = try await client.sessionStore.set(stored)
        await assertCacheMiss(client)
    }

    func testStableRefreshSkipsPurgeAndOptOutRetainsPreviousEntries() async throws {
        let initial = try session(subject: "stable-user", expOffset: 3_600, iatOffset: 0)
        let refreshed = try session(subject: "stable-user", expOffset: 7_200, iatOffset: 60)
        let refreshStore = FactoryCacheStore()
        let refreshClient = serverClient(
            session: initial,
            store: refreshStore,
            transport: FactoryGraphQLTransport()
        )
        try await seed(refreshClient)
        _ = try await refreshClient.sessionStore.set(refreshed)
        let refreshedCached = try await cached(refreshClient)
        XCTAssertEqual(refreshedCached.body.data?.ok, true)
        let refreshInvalidations = await refreshStore.invalidationCount()
        XCTAssertEqual(refreshInvalidations, 0)

        let retainedStore = FactoryCacheStore()
        let retainedClient = serverClient(
            session: initial,
            store: retainedStore,
            transport: FactoryGraphQLTransport(),
            purgePreviousScope: false
        )
        try await seed(retainedClient)
        try await retainedClient.clearSession()
        _ = try await retainedClient.sessionStore.set(initial)
        let retained = try await cached(retainedClient)
        XCTAssertEqual(retained.body.data?.ok, true)
        let retainedInvalidations = await retainedStore.invalidationCount()
        XCTAssertEqual(retainedInvalidations, 0)
    }

    func testClearSessionPurgesCustomResolverEntryThroughOldUserFacet() async throws {
        let stored = try session(subject: "custom-resolver-user")
        let store = FactoryCacheStore()
        let client = customResolverServerClient(
            session: stored,
            store: store,
            transport: FactoryGraphQLTransport()
        )

        try await seed(client)
        let recordedFacets = await store.lastWrittenFacets()
        let writtenFacets = try XCTUnwrap(recordedFacets)
        XCTAssertNotNil(writtenFacets.userIdentity)

        try await client.clearSession()
        _ = try await client.sessionStore.set(stored)
        await assertCacheMiss(client)

        let filters = await store.recordedInvalidationFilters()
        XCTAssertEqual(filters.count, 2)
        let derivedScopeFilter = try XCTUnwrap(filters.first)
        let derivedScope = try XCTUnwrap(derivedScopeFilter.authorizationScope)
        XCTAssertNotEqual(derivedScope, writtenFacets.authorizationScope)
        XCTAssertNil(derivedScopeFilter.userIdentity)
        let oldUserFilter = try XCTUnwrap(filters.last)
        XCTAssertNil(oldUserFilter.authorizationScope)
        XCTAssertEqual(oldUserFilter.userIdentity, writtenFacets.userIdentity)
    }

    func testCleanupFailureIsDiagnosticOnlyAndDoesNotChangeSessionSuccess() async throws {
        let stored = try session(subject: "failure-user")
        let store = FactoryCacheStore()
        let diagnostics = CacheDiagnosticRecorder()
        let client = serverClient(
            session: stored,
            store: store,
            transport: FactoryGraphQLTransport(),
            diagnostics: diagnostics
        )
        try await seed(client)
        await store.setInvalidationFailure(true)

        _ = try await client.auth.signOut(body: AuthSignOutRequest())
        _ = try await client.sessionStore.set(stored)
        let retained = try await cached(client)
        XCTAssertEqual(retained.body.data?.ok, true)
        XCTAssertTrue(diagnostics.kinds().contains(.cleanupFailure))
    }

    func testSlowCleanupDoesNotBlockSessionNotificationsAndTransitionsStayOrdered() async throws {
        let first = try session(subject: "ordered-a")
        let second = try session(subject: "ordered-b")
        let third = try session(subject: "ordered-c")
        let store = FactoryCacheStore()
        let client = serverClient(
            session: first,
            store: store,
            transport: FactoryGraphQLTransport()
        )
        try await seed(client)
        let invalidationGate = CacheReadGate()
        await store.gateNextInvalidation(invalidationGate)
        let notification = FactoryAsyncSignal()
        let subscription = client.sessionStore.subscribe { _ in
            await notification.signal()
        }

        let firstTransition = Task { try await client.sessionStore.set(second) }
        await notification.wait()
        _ = try await firstTransition.value
        await invalidationGate.waitUntilEntered()

        _ = try await client.sessionStore.set(third)
        let countWhileFirstCleanupIsBlocked = await store.invalidationCount()
        XCTAssertEqual(countWhileFirstCleanupIsBlocked, 1)

        await invalidationGate.release()
        await assertCacheMiss(client)
        let finalInvalidationCount = await store.invalidationCount()
        XCTAssertEqual(finalInvalidationCount, 4)
        await subscription.cancel()
    }

    func testIndependentStoreRereadTransitionsGraphQLCacheScope() async throws {
        let initial = try session(subject: "cross-store-a")
        let replacement = try session(subject: "cross-store-b")
        let backend = MemorySessionStorageBackend(session: initial)
        let cacheStore = FactoryCacheStore()
        let client = createServerClient(
            NhostServerClientOptions(
                authURL: authURL,
                graphqlURL: graphQLURL,
                sessionManagement: .server(storage: backend),
                transport: FactoryGraphQLTransport(),
                graphqlCache: GraphQLCacheConfiguration(store: cacheStore)
            )
        )
        let independentStore = SessionStore(storage: backend)
        try await seed(client)
        let invalidationGate = CacheReadGate()
        await cacheStore.gateNextInvalidation(invalidationGate)

        _ = try await independentStore.set(replacement)
        await assertCacheMiss(client)
        await invalidationGate.waitUntilEntered()
        let invalidations = await cacheStore.invalidationCount()
        XCTAssertEqual(invalidations, 1)
        await invalidationGate.release()
    }

    func testSessionHygieneLifetimeFollowsCopiedGraphQLClient() async throws {
        let stored = try session(subject: "copied-user")
        let store = FactoryCacheStore()
        var parent: NhostClient? = serverClient(
            session: stored,
            store: store,
            transport: FactoryGraphQLTransport()
        )
        let graphql = try XCTUnwrap(parent?.graphql)
        let sessionStore = try XCTUnwrap(parent?.sessionStore)
        _ = try await graphql.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
        parent = nil

        try await sessionStore.remove()
        _ = try await sessionStore.set(stored)
        do {
            _ = try await graphql.request(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
            )
            XCTFail("the copied GraphQL client must retain session cleanup observation")
        } catch {
            XCTAssertEqual(error as? GraphQLCacheError, .miss)
        }
    }
}

extension NhostClientGraphQLCacheTests {
    func serverClient(
        session: StoredSession,
        store: FactoryCacheStore,
        transport: FactoryGraphQLTransport,
        purgePreviousScope: Bool = true,
        diagnostics: CacheDiagnosticRecorder? = nil
    ) -> NhostClient {
        createServerClient(
            NhostServerClientOptions(
                authURL: authURL,
                graphqlURL: graphQLURL,
                sessionManagement: .server(
                    storage: MemorySessionStorageBackend(session: session)
                ),
                transport: transport,
                graphqlCache: GraphQLCacheConfiguration(
                    purgePreviousScopeOnSignOut: purgePreviousScope,
                    store: store,
                    diagnosticObserver: diagnostics?.record
                )
            )
        )
    }

    func customResolverServerClient(
        session: StoredSession,
        store: FactoryCacheStore,
        transport: FactoryGraphQLTransport
    ) -> NhostClient {
        let middleware: ChainFunction = { request, next in
            var request = request
            request.setHeader("x-custom-tenant", "tenant-a")
            return try await next(request)
        }
        return createServerClient(
            NhostServerClientOptions(
                authURL: authURL,
                graphqlURL: graphQLURL,
                sessionManagement: .server(
                    storage: MemorySessionStorageBackend(session: session)
                ),
                transport: transport,
                middleware: [middleware],
                role: "user",
                graphqlCache: GraphQLCacheConfiguration(
                    store: store,
                    scopeResolver: { _ in
                        GraphQLCacheCustomScope(
                            identifier: "tenant-a",
                            protectedHeaders: ["x-custom-tenant": "tenant-a"]
                        )
                    }
                )
            )
        )
    }

    func session(
        subject: String,
        expOffset: Int = 3_600,
        iatOffset: Int = 0
    ) throws -> StoredSession {
        let now = Int(Date().timeIntervalSince1970)
        let token = try testAccessToken(
            exp: now + expOffset,
            iat: now + iatOffset,
            subject: subject
        )
        return try StoredSession(try testAuthSession(exp: now + expOffset, accessToken: token))
    }

    func seed(_ client: NhostClient) async throws {
        _ = try await client.graphql.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
    }

    func cached(
        _ client: NhostClient
    ) async throws -> NhostResponse<GraphQLResponse<CacheBoolData>> {
        try await client.graphql.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
        )
    }

    func assertCacheMiss(_ client: NhostClient) async {
        do {
            _ = try await cached(client)
            XCTFail("expected the previous scope to be purged")
        } catch {
            XCTAssertEqual(error as? GraphQLCacheError, .miss)
        }
    }
}
