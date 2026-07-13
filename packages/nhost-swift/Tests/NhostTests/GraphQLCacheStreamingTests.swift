import Foundation
import XCTest
@testable import Nhost

extension GraphQLCachePolicyTests {
    func testStaleWhileRevalidateEmptyCacheEmitsOneStoredFreshValue() async throws {
        let store = CachePolicyStore()
        let queue = CacheResponseQueue([.response(success(ok: true))])
        let client = makeClient(queue: queue, store: store)

        let capture = await collect(
            client.staleWhileRevalidate(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
            )
        )

        XCTAssertNil(capture.error)
        XCTAssertEqual(capture.values.count, 1)
        assertFresh(capture.values[0], value: true, outcome: .stored)
        let counts = await store.counts()
        let calls = await queue.callCount()
        XCTAssertEqual(counts.reads, 1)
        XCTAssertEqual(counts.writes, 1)
        XCTAssertEqual(calls, 1)
    }

    func testStaleWhileRevalidateEmitsCachedThenFreshWithMetadata() async throws {
        let store = CachePolicyStore()
        let seedQueue = CacheResponseQueue([.response(success(ok: true))])
        let seedClient = makeClient(queue: seedQueue, store: store, clock: now)
        _ = try await seedClient.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )

        let refreshTime = now.addingTimeInterval(6)
        let queue = CacheResponseQueue([.response(success(ok: false))])
        let client = makeClient(
            queue: queue,
            store: store,
            freshnessTTL: 5,
            staleInterval: 20,
            clock: refreshTime
        )
        let capture = await collect(
            client.staleWhileRevalidate(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .networkFirst)
            )
        )

        XCTAssertNil(capture.error)
        XCTAssertEqual(capture.values.count, 2)
        switch capture.values[0] {
        case let .cached(response, metadata):
            XCTAssertEqual(response.body.data?.ok, true)
            XCTAssertEqual(metadata.source, .cached)
            XCTAssertEqual(metadata.createdAt, now)
            XCTAssertEqual(metadata.lastSuccessfulWriteAt, now)
            XCTAssertEqual(metadata.age, 6)
            XCTAssertTrue(metadata.isExpired)
            XCTAssertEqual(metadata.status, 200)
            XCTAssertEqual(metadata.persistenceOutcome, .notAttempted)
        case .fresh:
            XCTFail("cached response must be emitted first")
        }
        assertFresh(capture.values[1], value: false, outcome: .stored)
        let calls = await queue.callCount()
        XCTAssertEqual(calls, 1)
    }

    func testStaleWhileRevalidateIncludesExactStaleBoundaryAndExcludesBeyondIt() async throws {
        for (offset, expectedCount) in [(25.0, 2), (25.001, 1)] {
            let store = CachePolicyStore()
            let seedQueue = CacheResponseQueue([.response(success(ok: true))])
            let seedClient = makeClient(queue: seedQueue, store: store, clock: now)
            _ = try await seedClient.request(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
            )
            let queue = CacheResponseQueue([.response(success(ok: false))])
            let client = makeClient(
                queue: queue,
                store: store,
                freshnessTTL: 5,
                staleInterval: 20,
                clock: now.addingTimeInterval(offset)
            )

            let capture = await collect(
                client.staleWhileRevalidate(
                    CacheBoolData.self,
                    query: query,
                    cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
                )
            )

            XCTAssertNil(capture.error)
            XCTAssertEqual(capture.values.count, expectedCount, "offset: \(offset)")
        }
    }

    func testStaleWhileRevalidatePreservesExactRefreshErrorsAfterCachedEmission() async throws {
        let refreshes: [CacheResponseQueue.Item] = [
            .error(.transport("offline-exact")),
            .response(NhostRawResponse(
                status: 200,
                body: Data(#"{"errors":[{"message":"denied-exact"}]}"#.utf8)
            )),
            .response(NhostRawResponse(status: 200, body: Data("not-json-exact".utf8)))
        ]

        for (index, refresh) in refreshes.enumerated() {
            let store = CachePolicyStore()
            let seedQueue = CacheResponseQueue([.response(success(ok: true))])
            let seedClient = makeClient(queue: seedQueue, store: store)
            _ = try await seedClient.request(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
            )
            let queue = CacheResponseQueue([refresh])
            let client = makeClient(queue: queue, store: store)

            let capture = await collect(
                client.staleWhileRevalidate(
                    CacheBoolData.self,
                    query: query,
                    cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
                )
            )

            XCTAssertEqual(capture.values.count, 1, "refresh: \(index)")
            switch index {
            case 0:
                XCTAssertEqual(capture.error as? FetchError, .transport("offline-exact"))
            case 1:
                XCTAssertEqual((capture.error as? GraphQLExecutionError)?.messages, ["denied-exact"])
            default:
                guard case .decoding = capture.error as? FetchError else {
                    XCTFail("expected the exact decoding failure category")
                    continue
                }
            }
        }
    }

    func testStaleWhileRevalidateScopeChangesBeforeCachedYieldAndDuringRefreshFailClosed() async throws {
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

        let readGate = CacheReadGate()
        await store.setReadGate(readGate)
        let noRefreshQueue = CacheResponseQueue([])
        let readClient = makeManagedClient(
            queue: noRefreshQueue,
            store: store,
            sessionStore: sessionStore
        )
        let cacheQuery = query
        let beforeYield = Task {
            await collectStream(
                readClient.staleWhileRevalidate(
                    CacheBoolData.self,
                    query: cacheQuery,
                    cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
                )
            )
        }
        await readGate.waitUntilEntered()
        _ = try await sessionStore.set(try managedSession(subject: "user-2"))
        await readGate.release()
        let firstCapture = await beforeYield.value
        XCTAssertTrue(firstCapture.values.isEmpty)
        XCTAssertEqual(firstCapture.error as? GraphQLCacheError, .authorizationScopeChanged)
        let noRefreshCalls = await noRefreshQueue.callCount()
        XCTAssertEqual(noRefreshCalls, 0)

        await store.setReadGate(nil)
        let secondStore = CachePolicyStore()
        let secondSessionStore = SessionStore(
            storage: MemorySessionStorageBackend(session: try managedSession(subject: "user-1"))
        )
        let secondSeedQueue = CacheResponseQueue([.response(success(ok: true))])
        let secondSeedClient = makeManagedClient(
            queue: secondSeedQueue,
            store: secondStore,
            sessionStore: secondSessionStore
        )
        _ = try await secondSeedClient.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
        let refreshGate = CacheReadGate()
        let refreshQueue = CacheResponseQueue([.gated(success(ok: false), refreshGate)])
        let refreshClient = makeManagedClient(
            queue: refreshQueue,
            store: secondStore,
            sessionStore: secondSessionStore
        )
        let duringRefresh = Task {
            await collectStream(
                refreshClient.staleWhileRevalidate(
                    CacheBoolData.self,
                    query: cacheQuery,
                    cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
                )
            )
        }
        await refreshGate.waitUntilEntered()
        _ = try await secondSessionStore.set(try managedSession(subject: "user-2"))
        await refreshGate.release()
        let secondCapture = await duringRefresh.value
        XCTAssertEqual(secondCapture.values.count, 1)
        XCTAssertEqual(secondCapture.error as? GraphQLCacheError, .authorizationScopeChanged)
        let counts = await secondStore.counts()
        XCTAssertEqual(counts.writes, 1, "only the seed may be committed")
    }

    func testStaleWhileRevalidateScopeChangeAtPrecommitPreventsWriteAndFreshEmission() async throws {
        let sessionStore = SessionStore(
            storage: MemorySessionStorageBackend(session: try managedSession(subject: "user-1"))
        )
        let store = CachePolicyStore()
        let precommitGate = CacheReadGate()
        let snapshotGate = CacheSessionSnapshotGate(targetCall: 3, gate: precommitGate)
        let queue = CacheResponseQueue([.response(success(ok: true))])
        let instant = now
        let client = GraphQLClient(
            url: endpoint,
            transport: StubTransport { _ in try await queue.next() },
            middleware: [attachAccessTokenMiddleware(sessionStore: sessionStore)],
            cacheConfiguration: GraphQLCacheConfiguration(store: store),
            cacheScopeContext: GraphQLCacheClientScopeContext(
                defaultHeaders: [:],
                configuredRole: nil,
                adminSession: nil,
                usesManagedSession: true,
                hasCustomMiddleware: false,
                sessionSnapshot: { try await snapshotGate.snapshot(from: sessionStore) }
            ),
            cacheClock: { instant }
        )
        let cacheQuery = query
        let collection = Task {
            await collectStream(
                client.staleWhileRevalidate(
                    CacheBoolData.self,
                    query: cacheQuery,
                    cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
                )
            )
        }

        await precommitGate.waitUntilEntered()
        _ = try await sessionStore.set(try managedSession(subject: "user-2"))
        await precommitGate.release()
        let capture = await collection.value

        XCTAssertTrue(capture.values.isEmpty)
        XCTAssertEqual(capture.error as? GraphQLCacheError, .authorizationScopeChanged)
        let counts = await store.counts()
        XCTAssertEqual(counts.writes, 0)
    }

    func testStaleWhileRevalidateCancellationStopsLookupRefreshAndPrecommitEffects() async throws {
        let beforeLookupStore = CachePolicyStore()
        let lookupGate = CacheReadGate()
        await beforeLookupStore.setReadGate(lookupGate)
        let beforeLookupQueue = CacheResponseQueue([])
        let beforeLookupClient = makeClient(queue: beforeLookupQueue, store: beforeLookupStore)
        let cacheQuery = query
        let beforeLookup = Task {
            await collectStream(
                beforeLookupClient.staleWhileRevalidate(
                    CacheBoolData.self,
                    query: cacheQuery,
                    cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
                )
            )
        }
        await lookupGate.waitUntilEntered()
        beforeLookup.cancel()
        await lookupGate.release()
        let lookupCapture = await beforeLookup.value
        XCTAssertTrue(lookupCapture.values.isEmpty)
        let beforeLookupCalls = await beforeLookupQueue.callCount()
        XCTAssertEqual(beforeLookupCalls, 0)

        let store = CachePolicyStore()
        let seedQueue = CacheResponseQueue([.response(success(ok: true))])
        let seedClient = makeClient(queue: seedQueue, store: store)
        _ = try await seedClient.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
        let transportGate = CacheReadGate()
        let queue = CacheResponseQueue([.gated(success(ok: false), transportGate)])
        let client = makeClient(queue: queue, store: store)
        let duringTransport = Task {
            await collectStream(
                client.staleWhileRevalidate(
                    CacheBoolData.self,
                    query: cacheQuery,
                    cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
                )
            )
        }
        await transportGate.waitUntilEntered()
        duringTransport.cancel()
        await transportGate.release()
        let transportCapture = await duringTransport.value
        XCTAssertEqual(transportCapture.values.count, 1)
        let transportCounts = await store.counts()
        XCTAssertEqual(transportCounts.writes, 1, "cancelled refresh must not commit")

        let precommitStore = CachePolicyStore()
        let writeGate = CacheReadGate()
        await precommitStore.setWriteGate(writeGate)
        let precommitQueue = CacheResponseQueue([.response(success(ok: true))])
        let precommitClient = makeClient(queue: precommitQueue, store: precommitStore)
        let precommit = Task {
            await collectStream(
                precommitClient.staleWhileRevalidate(
                    CacheBoolData.self,
                    query: cacheQuery,
                    cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
                )
            )
        }
        await writeGate.waitUntilEntered()
        precommit.cancel()
        await writeGate.release()
        let precommitCapture = await precommit.value
        XCTAssertTrue(precommitCapture.values.isEmpty)
        let precommitCounts = await precommitStore.counts()
        XCTAssertEqual(precommitCounts.writes, 0)
    }

    func testStaleWhileRevalidateFreshMetadataReportsSkippedAndFailedPersistence() async throws {
        let failedStore = CachePolicyStore()
        await failedStore.setFailure(.write)
        let failedQueue = CacheResponseQueue([.response(success(ok: true))])
        let failedClient = makeClient(queue: failedQueue, store: failedStore)
        let failed = await collect(
            failedClient.staleWhileRevalidate(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
            )
        )
        XCTAssertNil(failed.error)
        XCTAssertEqual(failed.values.count, 1)
        assertFresh(failed.values[0], value: true, outcome: .failedAndReported)

        let skippedStore = CachePolicyStore()
        let skippedQueue = CacheResponseQueue([.response(success(ok: false))])
        let skippedClient = makeClient(
            queue: skippedQueue,
            configuration: GraphQLCacheConfiguration(
                maximumTotalBytes: 100,
                maximumEntryBytes: 1,
                store: skippedStore
            )
        )
        let skipped = await collect(
            skippedClient.staleWhileRevalidate(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
            )
        )
        XCTAssertNil(skipped.error)
        XCTAssertEqual(skipped.values.count, 1)
        assertFresh(skipped.values[0], value: false, outcome: .skipped)
    }

    func testStaleWhileRevalidateIneligibleAndNetworkOnlyEmitOneUnstoredFreshValue() async throws {
        let ineligibleStore = CachePolicyStore()
        let ineligibleQueue = CacheResponseQueue([.response(success(ok: true))])
        let configured = makeClient(queue: ineligibleQueue, store: ineligibleStore)
        let request = GraphQLRequest(query: "mutation Update { update }")
        let ineligible = await collect(
            configured.staleWhileRevalidate(
                CacheBoolData.self,
                request: request,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
            )
        )
        XCTAssertNil(ineligible.error)
        XCTAssertEqual(ineligible.values.count, 1)
        assertFresh(ineligible.values[0], value: true, outcome: .notAttempted)
        let ineligibleCounts = await ineligibleStore.counts()
        XCTAssertEqual(ineligibleCounts.reads, 0)
        XCTAssertEqual(ineligibleCounts.writes, 0)

        let networkOnlyStore = CachePolicyStore()
        let networkOnlyQueue = CacheResponseQueue([.response(success(ok: false))])
        let networkOnlyClient = makeClient(queue: networkOnlyQueue, store: networkOnlyStore)
        let networkOnly = await collect(
            networkOnlyClient.staleWhileRevalidate(CacheBoolData.self, query: query)
        )
        XCTAssertNil(networkOnly.error)
        XCTAssertEqual(networkOnly.values.count, 1)
        assertFresh(networkOnly.values[0], value: false, outcome: .notAttempted)
        let networkOnlyCounts = await networkOnlyStore.counts()
        XCTAssertEqual(networkOnlyCounts.reads, 0)
        XCTAssertEqual(networkOnlyCounts.writes, 0)
    }
}

private typealias StreamCapture = (
    values: [GraphQLCacheResult<CacheBoolData>],
    error: (any Error)?
)

private func collectStream(
    _ stream: AsyncThrowingStream<GraphQLCacheResult<CacheBoolData>, Error>
) async -> StreamCapture {
    var values: [GraphQLCacheResult<CacheBoolData>] = []
    do {
        for try await value in stream {
            values.append(value)
        }
        return (values, nil)
    } catch {
        return (values, error)
    }
}

private extension GraphQLCachePolicyTests {
    func collect(
        _ stream: AsyncThrowingStream<GraphQLCacheResult<CacheBoolData>, Error>
    ) async -> StreamCapture {
        var values: [GraphQLCacheResult<CacheBoolData>] = []
        do {
            for try await value in stream {
                values.append(value)
            }
            return (values, nil)
        } catch {
            return (values, error)
        }
    }

    func assertFresh(
        _ result: GraphQLCacheResult<CacheBoolData>,
        value: Bool,
        outcome: GraphQLCachePersistenceOutcome,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        switch result {
        case .cached:
            XCTFail("expected a fresh result", file: file, line: line)
        case let .fresh(response, metadata):
            XCTAssertEqual(response.body.data?.ok, value, file: file, line: line)
            XCTAssertEqual(metadata.source, .fresh, file: file, line: line)
            XCTAssertEqual(metadata.age, 0, file: file, line: line)
            XCTAssertFalse(metadata.isExpired, file: file, line: line)
            XCTAssertEqual(metadata.status, 200, file: file, line: line)
            XCTAssertEqual(metadata.persistenceOutcome, outcome, file: file, line: line)
        }
    }
}
