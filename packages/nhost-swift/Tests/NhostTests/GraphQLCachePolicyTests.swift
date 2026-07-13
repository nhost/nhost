import Foundation
import XCTest
@testable import Nhost

final class GraphQLCachePolicyTests: XCTestCase {
    let endpoint = URL(string: "https://graphql.example.test/v1")!
    let query = "query Viewer { ok }"
    let now = Date(timeIntervalSinceReferenceDate: 10_000)
}

extension GraphQLCachePolicyTests {
    func testNetworkOnlyUsesLegacyPathWithoutAnyCacheInteraction() async throws {
        let store = CachePolicyStore()
        let diagnostics = CacheDiagnosticRecorder()
        let queue = CacheResponseQueue([.response(success(ok: true))])
        let configuration = GraphQLCacheConfiguration(
            freshnessTTL: -1,
            store: store,
            diagnosticObserver: diagnostics.record
        )
        let client = makeClient(queue: queue, configuration: configuration)

        let response = try await client.request(CacheBoolData.self, query: query)
        let counts = await store.counts()
        let calls = await queue.callCount()

        XCTAssertEqual(response.body.data?.ok, true)
        XCTAssertEqual(calls, 1)
        XCTAssertEqual(counts.reads, 0)
        XCTAssertEqual(counts.writes, 0)
        XCTAssertEqual(counts.touches, 0)
        XCTAssertTrue(diagnostics.kinds().isEmpty)
    }

    func testCacheOnlyHitNeverCallsTransportAndTouchesEntry() async throws {
        let store = CachePolicyStore()
        let queue = CacheResponseQueue([.response(success(ok: true))])
        let client = makeClient(queue: queue, store: store)
        _ = try await client.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )

        let cached = try await client.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
        )
        let counts = await store.counts()
        let calls = await queue.callCount()

        XCTAssertEqual(cached.body.data?.ok, true)
        XCTAssertEqual(cached.status, 200)
        XCTAssertEqual(cached.headers, ["content-type": "Application/JSON; charset=utf-8"])
        XCTAssertEqual(calls, 1)
        XCTAssertEqual(counts.reads, 2)
        XCTAssertEqual(counts.touches, 1)
    }

    func testCacheOnlyMissExpiredAndIneligibleAreTypedAndNeverUseTransport() async throws {
        let store = CachePolicyStore()
        let queue = CacheResponseQueue([])
        let missClient = makeClient(queue: queue, store: store)
        await assertCacheError(.miss) {
            _ = try await missClient.request(
                CacheBoolData.self,
                query: self.query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
            )
        }
        await assertCacheError(.ineligibleOperation) {
            _ = try await missClient.request(
                CacheBoolData.self,
                query: "mutation Update { update }",
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
            )
        }

        let seedQueue = CacheResponseQueue([.response(success(ok: true))])
        let seedClient = makeClient(queue: seedQueue, store: store, clock: now)
        _ = try await seedClient.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
        let expiredClient = makeClient(
            queue: queue,
            store: store,
            freshnessTTL: 5,
            staleInterval: 20,
            clock: now.addingTimeInterval(6)
        )
        await assertCacheError(.expired) {
            _ = try await expiredClient.request(
                CacheBoolData.self,
                query: self.query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
            )
        }
        let calls = await queue.callCount()
        XCTAssertEqual(calls, 0)
    }

    func testCacheOnlyRejectsCustomStoreEntriesWithWrongProtectedFacets() async throws {
        let store = CachePolicyStore()
        await store.setFailure(.malformedRead)
        let queue = CacheResponseQueue([])
        let client = makeClient(queue: queue, store: store)

        await assertCacheError(.storeFailure("cache entry facet association failed")) {
            _ = try await client.request(
                CacheBoolData.self,
                query: self.query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
            )
        }
        let calls = await queue.callCount()
        XCTAssertEqual(calls, 0)
    }

    func testCacheFirstUsesFreshEntryAndRecoversMissFromNetwork() async throws {
        let store = CachePolicyStore()
        let queue = CacheResponseQueue([
            .response(success(ok: true)),
            .response(success(ok: false))
        ])
        let client = makeClient(queue: queue, store: store)
        let first = try await client.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
        let second = try await client.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
        let calls = await queue.callCount()

        XCTAssertEqual(first.body.data?.ok, true)
        XCTAssertEqual(second.body.data?.ok, true)
        XCTAssertEqual(calls, 1)
    }

    func testNetworkFirstFallsBackToBoundedStaleOnlyForTransportErrors() async throws {
        let store = CachePolicyStore()
        let seedQueue = CacheResponseQueue([.response(success(ok: true))])
        let seedClient = makeClient(queue: seedQueue, store: store, clock: now)
        _ = try await seedClient.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )

        let fallbackQueue = CacheResponseQueue([.error(.transport("offline"))])
        let fallbackClient = makeClient(
            queue: fallbackQueue,
            store: store,
            freshnessTTL: 5,
            staleInterval: 20,
            clock: now.addingTimeInterval(25)
        )
        let fallback = try await fallbackClient.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .networkFirst)
        )
        XCTAssertEqual(fallback.body.data?.ok, true)

        let tooOldQueue = CacheResponseQueue([.error(.transport("offline-original"))])
        let tooOldClient = makeClient(
            queue: tooOldQueue,
            store: store,
            freshnessTTL: 5,
            staleInterval: 20,
            clock: now.addingTimeInterval(25.001)
        )
        do {
            _ = try await tooOldClient.request(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .networkFirst)
            )
            XCTFail("expected transport failure")
        } catch {
            XCTAssertEqual(error as? FetchError, .transport("offline-original"))
        }
    }

    func testNetworkFirstDoesNotFallbackForCancellationHTTPOrDecodeFailures() async throws {
        for item in [
            CacheResponseQueue.Item.cancellation,
            .error(.http(NhostHTTPError(
                status: 401,
                headers: [:],
                body: nil,
                rawBody: Data(),
                messages: ["unauthorized"]
            ))),
            .error(.invalidResponse("invalid")),
            .response(NhostRawResponse(status: 200, body: Data("not-json".utf8))),
            .response(NhostRawResponse(
                status: 200,
                body: Data(#"{"errors":[{"message":"denied"}]}"#.utf8)
            ))
        ] {
            let store = CachePolicyStore()
            let seedQueue = CacheResponseQueue([.response(success(ok: true))])
            let seedClient = makeClient(queue: seedQueue, store: store)
            _ = try await seedClient.request(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
            )
            let queue = CacheResponseQueue([item])
            let client = makeClient(queue: queue, store: store)
            do {
                _ = try await client.request(
                    CacheBoolData.self,
                    query: query,
                    cacheOptions: GraphQLCacheRequestOptions(policy: .networkFirst)
                )
                XCTFail("expected network-side failure")
            } catch {
                if case .cancellation = item {
                    XCTAssertTrue(error is CancellationError)
                }
            }
            let counts = await store.counts()
            XCTAssertEqual(counts.reads, 1, "only the seeding miss may read the cache")
        }
    }

    func testNon2xxAndGraphQLErrorsAreNeverCached() async throws {
        let non2xxStore = CachePolicyStore()
        let non2xxQueue = CacheResponseQueue([
            .response(NhostRawResponse(status: 401, body: Data(#"{"data":{"ok":false}}"#.utf8)))
        ])
        let non2xxClient = makeClient(queue: non2xxQueue, store: non2xxStore)
        let response = try await non2xxClient.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
        XCTAssertEqual(response.status, 401)
        let non2xxCounts = await non2xxStore.counts()
        XCTAssertEqual(non2xxCounts.writes, 0)

        let errorStore = CachePolicyStore()
        let errorQueue = CacheResponseQueue([
            .response(NhostRawResponse(
                status: 200,
                body: Data(#"{"data":{"ok":true},"errors":[{"message":"partial"}]}"#.utf8)
            ))
        ])
        let errorClient = makeClient(queue: errorQueue, store: errorStore)
        do {
            _ = try await errorClient.request(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
            )
            XCTFail("expected GraphQL execution error")
        } catch is GraphQLExecutionError {}
        let errorCounts = await errorStore.counts()
        XCTAssertEqual(errorCounts.writes, 0)
    }

}
