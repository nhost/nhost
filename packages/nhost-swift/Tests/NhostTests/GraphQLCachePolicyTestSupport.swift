import Foundation
import XCTest
@testable import Nhost

struct CacheBoolData: Decodable, Equatable, Sendable {
    let ok: Bool
}

struct CacheStringData: Decodable, Equatable, Sendable {
    let value: String
}

actor CacheResponseQueue {
    enum Item: Sendable {
        case response(NhostRawResponse)
        case gated(NhostRawResponse, CacheReadGate)
        case error(FetchError)
        case cancellation
    }

    private var items: [Item]
    private var calls = 0

    init(_ items: [Item]) {
        self.items = items
    }

    func next() async throws -> NhostRawResponse {
        calls += 1
        guard !items.isEmpty else {
            throw FetchError.transport("unexpected transport call")
        }
        switch items.removeFirst() {
        case let .response(response):
            return response
        case let .gated(response, gate):
            await gate.pause()
            return response
        case let .error(error):
            throw error
        case .cancellation:
            throw CancellationError()
        }
    }

    func callCount() -> Int {
        calls
    }
}

actor CacheReadGate {
    private var entered = false
    private var enteredWaiters: [CheckedContinuation<Void, Never>] = []
    private var releaseContinuation: CheckedContinuation<Void, Never>?

    func pause() async {
        entered = true
        let waiters = enteredWaiters
        enteredWaiters.removeAll()
        for waiter in waiters { waiter.resume() }
        await withCheckedContinuation { continuation in
            releaseContinuation = continuation
        }
    }

    func waitUntilEntered() async {
        if entered { return }
        await withCheckedContinuation { continuation in
            enteredWaiters.append(continuation)
        }
    }

    func release() {
        releaseContinuation?.resume()
        releaseContinuation = nil
    }
}

actor CacheSessionSnapshotGate {
    private let targetCall: Int
    private let gate: CacheReadGate
    private var calls = 0

    init(targetCall: Int, gate: CacheReadGate) {
        self.targetCall = targetCall
        self.gate = gate
    }

    func snapshot(from sessionStore: SessionStore) async throws -> SessionAuthorizationSnapshot {
        calls += 1
        if calls == targetCall {
            await gate.pause()
        }
        return try await sessionStore.authorizationSnapshot()
    }
}

actor CacheSessionSnapshotFailure {
    private let failingCall: Int
    private var calls = 0

    init(failingCall: Int) {
        self.failingCall = failingCall
    }

    func snapshot(from sessionStore: SessionStore) async throws -> SessionAuthorizationSnapshot {
        calls += 1
        if calls == failingCall {
            throw SnapshotError.unavailable
        }
        return try await sessionStore.authorizationSnapshot()
    }

    private enum SnapshotError: Error {
        case unavailable
    }
}

actor CachePolicyStore: GraphQLCacheStore {
    struct Counts: Sendable {
        let reads: Int
        let writes: Int
        let touches: Int
        let removals: Int
    }

    enum Failure: Sendable {
        case none
        case read
        case malformedRead
        case write
        case touch
        case remove
    }

    private let backing = MemoryGraphQLCacheStore()
    private var failure: Failure = .none
    private var readGate: CacheReadGate?
    private var writeGate: CacheReadGate?
    private var reads = 0
    private var writes = 0
    private var touches = 0
    private var removals = 0

    func setFailure(_ value: Failure) {
        failure = value
    }

    func setReadGate(_ value: CacheReadGate?) {
        readGate = value
    }

    func setWriteGate(_ value: CacheReadGate?) {
        writeGate = value
    }

    func counts() -> Counts {
        Counts(reads: reads, writes: writes, touches: touches, removals: removals)
    }

    func entry(for key: GraphQLCacheKey) async throws -> GraphQLCacheEntry? {
        reads += 1
        if let readGate { await readGate.pause() }
        if failure == .read { throw StoreFailure.failed }
        if failure == .malformedRead {
            let digest = GraphQLCacheDigest(
                rawValue: NhostSHA256.hexadecimalDigest(Data("wrong-facet".utf8))
            )
            return GraphQLCacheEntry(
                key: key,
                body: Data(#"{"data":{"ok":true}}"#.utf8),
                status: 200,
                contentType: "application/json",
                createdAt: Date(timeIntervalSinceReferenceDate: 1),
                lastSuccessfulWriteAt: Date(timeIntervalSinceReferenceDate: 1),
                lastAccessedAt: Date(timeIntervalSinceReferenceDate: 1),
                facets: GraphQLCacheEntryFacets(
                    endpoint: digest,
                    authorizationScope: digest,
                    userIdentity: nil,
                    operationName: nil,
                    namespace: nil,
                    tags: []
                )
            )
        }
        return try await backing.entry(for: key)
    }

    func write(_ entry: GraphQLCacheEntry, for key: GraphQLCacheKey) async throws {
        if let writeGate { await writeGate.pause() }
        try Task.checkCancellation()
        writes += 1
        if failure == .write { throw StoreFailure.failed }
        try await backing.write(entry, for: key)
    }

    func removeEntry(for key: GraphQLCacheKey) async throws {
        removals += 1
        if failure == .remove { throw StoreFailure.failed }
        await backing.removeEntry(for: key)
    }

    func touchEntry(for key: GraphQLCacheKey, at date: Date) async throws {
        touches += 1
        if failure == .touch { throw StoreFailure.failed }
        try await backing.touchEntry(for: key, at: date)
    }

    func invalidate(_ filter: GraphQLCacheStoreFilter) async throws -> Int {
        await backing.invalidate(filter)
    }

    func prune() async throws {
        await backing.prune()
    }

    private enum StoreFailure: Error {
        case failed
    }
}

final class CacheDiagnosticRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var values: [GraphQLCacheDiagnostic] = []

    func record(_ diagnostic: GraphQLCacheDiagnostic) {
        lock.lock()
        values.append(diagnostic)
        lock.unlock()
    }

    func kinds() -> [GraphQLCacheDiagnosticKind] {
        lock.lock()
        defer { lock.unlock() }
        return values.map(\.kind)
    }
}

extension GraphQLCachePolicyTests {
    func makeManagedClient(
        queue: CacheResponseQueue,
        store: CachePolicyStore,
        sessionStore: SessionStore
    ) -> GraphQLClient {
        makeManagedClient(
            queue: queue,
            sessionStore: sessionStore,
            configuration: GraphQLCacheConfiguration(store: store),
            sessionSnapshot: { try await sessionStore.authorizationSnapshot() }
        )
    }

    func makeManagedClient(
        queue: CacheResponseQueue,
        sessionStore: SessionStore,
        configuration: GraphQLCacheConfiguration,
        sessionSnapshot: @escaping @Sendable () async throws -> SessionAuthorizationSnapshot?
    ) -> GraphQLClient {
        let instant = now
        return GraphQLClient(
            url: endpoint,
            transport: StubTransport { _ in try await queue.next() },
            middleware: [attachAccessTokenMiddleware(sessionStore: sessionStore)],
            cacheConfiguration: configuration,
            cacheScopeContext: GraphQLCacheClientScopeContext(
                defaultHeaders: [:],
                configuredRole: nil,
                adminSession: nil,
                usesManagedSession: true,
                hasCustomMiddleware: false,
                sessionSnapshot: sessionSnapshot
            ),
            cacheClock: { instant }
        )
    }

    func managedSession(subject: String) throws -> StoredSession {
        let token = try testAccessToken(
            exp: testNowSeconds + 3_600,
            iat: testNowSeconds,
            subject: subject,
            hasuraClaims: [
                "x-hasura-default-role": "user",
                "x-hasura-allowed-roles": "{user}"
            ]
        )
        return try StoredSession(try testAuthSession(exp: testNowSeconds + 3_600, accessToken: token))
    }

    func makeClient(
        queue: CacheResponseQueue,
        store: CachePolicyStore,
        freshnessTTL: TimeInterval = 300,
        staleInterval: TimeInterval = 86_400,
        clock: Date? = nil
    ) -> GraphQLClient {
        makeClient(
            queue: queue,
            configuration: GraphQLCacheConfiguration(
                freshnessTTL: freshnessTTL,
                staleIfErrorInterval: staleInterval,
                store: store
            ),
            clock: clock
        )
    }

    func makeClient(
        queue: CacheResponseQueue,
        configuration: GraphQLCacheConfiguration,
        clock: Date? = nil
    ) -> GraphQLClient {
        let instant = clock ?? now
        return GraphQLClient(
            url: endpoint,
            transport: StubTransport { _ in try await queue.next() },
            middleware: [],
            cacheConfiguration: configuration,
            cacheScopeContext: .standalone(hasCustomMiddleware: false),
            cacheClock: { instant }
        )
    }

    func success(ok value: Bool) -> NhostRawResponse {
        NhostRawResponse(
            status: 200,
            headers: ["content-type": "Application/JSON; charset=utf-8", "x-private": "omit"],
            body: Data("{\"data\":{\"ok\":\(value)}}".utf8)
        )
    }

    func assertCacheError(
        _ expected: GraphQLCacheError,
        operation: () async throws -> Void
    ) async {
        do {
            try await operation()
            XCTFail("expected \(expected)")
        } catch {
            XCTAssertEqual(error as? GraphQLCacheError, expected)
        }
    }}
