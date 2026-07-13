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
        let client = makeManagedClient(queue: queue, store: store, sessionStore: sessionStore)
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
