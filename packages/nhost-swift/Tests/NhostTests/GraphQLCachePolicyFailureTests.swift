import Foundation
import XCTest
@testable import Nhost

extension GraphQLCachePolicyTests {
    func testDecoderIncompatibilityEvictsAndCacheFirstRecoversFromNetwork() async throws {
        let store = CachePolicyStore()
        let seedQueue = CacheResponseQueue([.response(success(ok: true))])
        let seedClient = makeClient(queue: seedQueue, store: store)
        _ = try await seedClient.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )

        let recoveryQueue = CacheResponseQueue([
            .response(NhostRawResponse(status: 200, body: Data(#"{"data":{"value":"fresh"}}"#.utf8)))
        ])
        let recoveryClient = makeClient(queue: recoveryQueue, store: store)
        let recovered = try await recoveryClient.request(
            CacheStringData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
        let counts = await store.counts()

        XCTAssertEqual(recovered.body.data?.value, "fresh")
        XCTAssertEqual(counts.removals, 1)
    }

    func testWriteFailureIsDiagnosticAndDoesNotReplaceNetworkSuccess() async throws {
        let store = CachePolicyStore()
        await store.setFailure(.write)
        let diagnostics = CacheDiagnosticRecorder()
        let queue = CacheResponseQueue([.response(success(ok: true))])
        let configuration = GraphQLCacheConfiguration(
            store: store,
            diagnosticObserver: diagnostics.record
        )
        let client = makeClient(queue: queue, configuration: configuration)

        let response = try await client.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )

        XCTAssertEqual(response.body.data?.ok, true)
        XCTAssertTrue(diagnostics.kinds().contains(.storeWriteFailure))
    }

    func testTouchFailureIsDiagnosticAndDoesNotReplaceCacheHit() async throws {
        let store = CachePolicyStore()
        let seedQueue = CacheResponseQueue([.response(success(ok: true))])
        let seedClient = makeClient(queue: seedQueue, store: store)
        _ = try await seedClient.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )

        await store.setFailure(.touch)
        let diagnostics = CacheDiagnosticRecorder()
        let cacheOnlyQueue = CacheResponseQueue([])
        let cacheOnlyClient = makeClient(
            queue: cacheOnlyQueue,
            configuration: GraphQLCacheConfiguration(
                store: store,
                diagnosticObserver: diagnostics.record
            )
        )
        let response = try await cacheOnlyClient.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
        )
        let calls = await cacheOnlyQueue.callCount()

        XCTAssertEqual(response.body.data?.ok, true)
        XCTAssertEqual(calls, 0)
        XCTAssertTrue(diagnostics.kinds().contains(.storeTouchFailure))
    }

    func testNetworkFirstStoreFailurePreservesOriginalTransportError() async throws {
        let store = CachePolicyStore()
        await store.setFailure(.read)
        let queue = CacheResponseQueue([.error(.transport("primary"))])
        let client = makeClient(queue: queue, store: store)

        do {
            _ = try await client.request(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .networkFirst)
            )
            XCTFail("expected transport error")
        } catch {
            XCTAssertEqual(error as? FetchError, .transport("primary"))
        }
    }

    func testScopeChangeDuringNetworkPreventsReturnAndWrite() async throws {
        let sessionStore = SessionStore(
            storage: MemorySessionStorageBackend(session: try managedSession(subject: "user-1"))
        )
        let store = CachePolicyStore()
        let gate = CacheReadGate()
        let queue = CacheResponseQueue([.gated(success(ok: true), gate)])
        let diagnostics = CacheDiagnosticRecorder()
        let client = makeManagedClient(
            queue: queue,
            sessionStore: sessionStore,
            configuration: GraphQLCacheConfiguration(
                store: store,
                diagnosticObserver: diagnostics.record
            ),
            sessionSnapshot: { try await sessionStore.authorizationSnapshot() }
        )
        let cacheQuery = query
        let task = Task {
            try await client.request(
                CacheBoolData.self,
                query: cacheQuery,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
            )
        }
        await gate.waitUntilEntered()
        _ = try await sessionStore.set(try managedSession(subject: "user-2"))
        await gate.release()

        do {
            _ = try await task.value
            XCTFail("expected authorization scope change")
        } catch {
            XCTAssertEqual(error as? GraphQLCacheError, .authorizationScopeChanged)
        }
        let counts = await store.counts()
        XCTAssertEqual(counts.writes, 0)
        XCTAssertTrue(diagnostics.kinds().contains(.sessionAuthorizationChanged))
    }

    func testProtectedRequestMismatchFailsClosedWithDiagnostic() async throws {
        let sessionStore = SessionStore(
            storage: MemorySessionStorageBackend(session: try managedSession(subject: "user-1"))
        )
        let store = CachePolicyStore()
        let diagnostics = CacheDiagnosticRecorder()
        let queue = CacheResponseQueue([.response(success(ok: true))])
        let instant = now
        let client = GraphQLClient(
            url: endpoint,
            transport: StubTransport { _ in try await queue.next() },
            middleware: [
                attachAccessTokenMiddleware(sessionStore: sessionStore),
                roleMiddleware("unexpected-role")
            ],
            cacheConfiguration: GraphQLCacheConfiguration(
                store: store,
                diagnosticObserver: diagnostics.record
            ),
            cacheScopeContext: GraphQLCacheClientScopeContext(
                defaultHeaders: [:],
                configuredRole: nil,
                adminSession: nil,
                usesManagedSession: true,
                hasCustomMiddleware: false,
                sessionSnapshot: { try await sessionStore.authorizationSnapshot() }
            ),
            cacheClock: { instant }
        )

        await assertCacheError(.authorizationScopeChanged) {
            _ = try await client.request(
                CacheBoolData.self,
                query: self.query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
            )
        }
        let counts = await store.counts()
        XCTAssertEqual(counts.writes, 0)
        XCTAssertTrue(diagnostics.kinds().contains(.protectedRequestStateChanged))
    }

    func testScopeChangeDuringCacheReadFailsClosedWithoutTransport() async throws {
        let sessionStore = SessionStore(
            storage: MemorySessionStorageBackend(session: try managedSession(subject: "user-1"))
        )
        let store = CachePolicyStore()
        let seedQueue = CacheResponseQueue([.response(success(ok: true))])
        let seedClient = makeManagedClient(queue: seedQueue, store: store, sessionStore: sessionStore)
        _ = try await seedClient.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )

        let gate = CacheReadGate()
        await store.setReadGate(gate)
        let offlineQueue = CacheResponseQueue([])
        let cacheClient = makeManagedClient(queue: offlineQueue, store: store, sessionStore: sessionStore)
        let cacheQuery = query
        let task = Task {
            try await cacheClient.request(
                CacheBoolData.self,
                query: cacheQuery,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
            )
        }
        await gate.waitUntilEntered()
        _ = try await sessionStore.set(try managedSession(subject: "user-2"))
        await gate.release()

        do {
            _ = try await task.value
            XCTFail("expected authorization scope change")
        } catch {
            XCTAssertEqual(error as? GraphQLCacheError, .authorizationScopeChanged)
        }
        let calls = await offlineQueue.callCount()
        XCTAssertEqual(calls, 0)
    }

    func testUnavailableFinalSessionSnapshotReturnsNetworkSuccessWithoutCaching() async throws {
        let sessionStore = SessionStore(
            storage: MemorySessionStorageBackend(session: try managedSession(subject: "user-1"))
        )
        let snapshotFailure = CacheSessionSnapshotFailure(failingCall: 2)
        let store = CachePolicyStore()
        let diagnostics = CacheDiagnosticRecorder()
        let queue = CacheResponseQueue([.response(success(ok: true))])
        let client = makeManagedClient(
            queue: queue,
            sessionStore: sessionStore,
            configuration: GraphQLCacheConfiguration(
                store: store,
                diagnosticObserver: diagnostics.record
            ),
            sessionSnapshot: {
                try await snapshotFailure.snapshot(from: sessionStore)
            }
        )

        let response = try await client.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
        let counts = await store.counts()

        XCTAssertEqual(response.body.data?.ok, true)
        XCTAssertEqual(counts.writes, 0)
        XCTAssertTrue(diagnostics.kinds().contains(.unavailableScope))
        XCTAssertFalse(diagnostics.kinds().contains(.sessionAuthorizationChanged))
        XCTAssertFalse(diagnostics.kinds().contains(.protectedRequestStateChanged))
    }

    func testUnavailablePostWriteSnapshotRemovesEntryAndReturnsNetworkSuccess() async throws {
        let sessionStore = SessionStore(
            storage: MemorySessionStorageBackend(session: try managedSession(subject: "user-1"))
        )
        let snapshotFailure = CacheSessionSnapshotFailure(failingCall: 4)
        let store = CachePolicyStore()
        let diagnostics = CacheDiagnosticRecorder()
        let queue = CacheResponseQueue([.response(success(ok: true))])
        let client = makeManagedClient(
            queue: queue,
            sessionStore: sessionStore,
            configuration: GraphQLCacheConfiguration(
                store: store,
                diagnosticObserver: diagnostics.record
            ),
            sessionSnapshot: {
                try await snapshotFailure.snapshot(from: sessionStore)
            }
        )

        let response = try await client.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
        let counts = await store.counts()

        XCTAssertEqual(response.body.data?.ok, true)
        XCTAssertEqual(counts.writes, 1)
        XCTAssertEqual(counts.removals, 1)
        XCTAssertTrue(diagnostics.kinds().contains(.unavailableScope))
    }

    func testUnavailableSessionSnapshotKeepsCacheOnlyFailClosed() async throws {
        let sessionStore = SessionStore(
            storage: MemorySessionStorageBackend(session: try managedSession(subject: "user-1"))
        )
        let store = CachePolicyStore()
        let seedQueue = CacheResponseQueue([.response(success(ok: true))])
        let seedClient = makeManagedClient(
            queue: seedQueue,
            store: store,
            sessionStore: sessionStore
        )
        _ = try await seedClient.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )

        let snapshotFailure = CacheSessionSnapshotFailure(failingCall: 2)
        let diagnostics = CacheDiagnosticRecorder()
        let offlineQueue = CacheResponseQueue([])
        let cacheClient = makeManagedClient(
            queue: offlineQueue,
            sessionStore: sessionStore,
            configuration: GraphQLCacheConfiguration(
                store: store,
                diagnosticObserver: diagnostics.record
            ),
            sessionSnapshot: {
                try await snapshotFailure.snapshot(from: sessionStore)
            }
        )

        await assertCacheError(.unavailableScope) {
            _ = try await cacheClient.request(
                CacheBoolData.self,
                query: self.query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
            )
        }
        let calls = await offlineQueue.callCount()
        XCTAssertEqual(calls, 0)
        XCTAssertTrue(diagnostics.kinds().contains(.unavailableScope))
    }

    func testDisabledCacheHandleAndOpaqueFetchCacheOnlyReportNotConfigured() async throws {
        let client = GraphQLClient(url: endpoint, fetch: { _ in
            XCTFail("cacheOnly must not call an opaque fetch")
            return NhostRawResponse(status: 200)
        })
        await assertCacheError(.notConfigured) {
            _ = try await client.request(
                CacheBoolData.self,
                query: self.query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
            )
        }
        await assertCacheError(.notConfigured) {
            _ = try await client.cache.invalidate()
        }
    }

}
