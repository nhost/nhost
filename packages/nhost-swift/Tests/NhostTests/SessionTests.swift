import Foundation
import XCTest
@testable import Nhost

let testNowSeconds = 1_700_000_000

func testAccessToken(
    exp: Int = testNowSeconds + 3_600,
    iat: Int = testNowSeconds,
    subject: String = "user-1",
    hasuraClaims: [String: Any] = [
        "x-hasura-default-role": "user",
        "x-hasura-allowed-roles": "{user,editor}"
    ]
) throws -> String {
    let header = try base64URLEncodeJSONObject(["alg": "none", "typ": "JWT"])
    let payload = try base64URLEncodeJSONObject([
        "exp": exp,
        "iat": iat,
        "iss": "nhost-tests",
        "sub": subject,
        DecodedToken.hasuraClaimsKey: hasuraClaims
    ])

    return "\(header).\(payload).signature"
}

private func base64URLEncodeJSONObject(_ object: [String: Any]) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    return base64URLEncode(data)
}

private func base64URLEncode(_ data: Data) -> String {
    data.base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
        .replacingOccurrences(of: "=", with: "")
}

func testAuthSession(
    exp: Int = testNowSeconds + 3_600,
    accessToken: String? = nil,
    refreshToken: String = "refresh-token",
    refreshTokenId: String = "refresh-token-id"
) throws -> AuthSession {
    let token: String
    if let accessToken {
        token = accessToken
    } else {
        token = try testAccessToken(exp: exp)
    }

    return AuthSession(
        accessToken: token,
        accessTokenExpiresIn: max(exp - testNowSeconds, 0),
        refreshTokenId: refreshTokenId,
        refreshToken: refreshToken,
        user: nil
    )
}

private actor SessionChangeRecorder {
    private var values: [String?] = []
    private var waiters: [(count: Int, continuation: CheckedContinuation<Void, Never>)] = []

    func append(_ session: StoredSession?) {
        values.append(session?.accessToken)
        resumeSatisfiedWaiters()
    }

    func waitUntilCount(_ count: Int) async {
        guard values.count < count else { return }
        await withCheckedContinuation { continuation in
            waiters.append((count, continuation))
        }
    }

    func snapshot() -> [String?] {
        values
    }

    private func resumeSatisfiedWaiters() {
        let ready = waiters.filter { values.count >= $0.count }
        waiters.removeAll { values.count >= $0.count }
        for waiter in ready {
            waiter.continuation.resume()
        }
    }
}

private actor SessionTransitionRecorder {
    private var values: [(String?, String?)] = []
    private var waiters: [(count: Int, continuation: CheckedContinuation<Void, Never>)] = []

    func append(old: StoredSession?, new: StoredSession?) {
        values.append((old?.decodedToken.subject, new?.decodedToken.subject))
        let ready = waiters.filter { values.count >= $0.count }
        waiters.removeAll { values.count >= $0.count }
        for waiter in ready {
            waiter.continuation.resume()
        }
    }

    func waitUntilCount(_ count: Int) async {
        guard values.count < count else { return }
        await withCheckedContinuation { continuation in
            waiters.append((count, continuation))
        }
    }

    func snapshot() -> [(String?, String?)] {
        values
    }
}

private final class CountingSessionCoordinator: SessionCoordinator, @unchecked Sendable {
    private let lock = NSLock()
    private var acquisitions = 0

    func withCoordination<Result: Sendable>(
        _ operation: @Sendable () async throws -> Result
    ) async throws -> Result {
        lock.withLock { acquisitions += 1 }
        return try await operation()
    }

    func count() -> Int {
        lock.withLock { acquisitions }
    }
}

private actor SessionTransactionContextBox {
    private var context: SessionTransactionContext?

    func set(_ context: SessionTransactionContext) {
        self.context = context
    }

    func get() -> SessionTransactionContext? {
        context
    }
}

private actor SessionCompletionProbe {
    private var isComplete = false

    func complete() {
        isComplete = true
    }

    func value() -> Bool {
        isComplete
    }
}

private actor GatedCommitSessionBackend: SessionStorageBackend {
    private var session: StoredSession?
    private let entered: CoordinationSignal
    private let release: CoordinationSignal

    init(
        session: StoredSession?,
        entered: CoordinationSignal,
        release: CoordinationSignal
    ) {
        self.session = session
        self.entered = entered
        self.release = release
    }

    func get() async throws -> StoredSession? {
        session
    }

    func set(_ value: StoredSession) async throws {
        await entered.signal()
        await release.wait()
        session = value
    }

    func remove() async throws {
        await entered.signal()
        await release.wait()
        session = nil
    }
}

private actor SubjectRecorder {
    private var values: [String?] = []
    private var waiters: [(count: Int, continuation: CheckedContinuation<Void, Never>)] = []

    func append(_ session: StoredSession?) {
        values.append(session?.decodedToken.subject)
        let ready = waiters.filter { values.count >= $0.count }
        waiters.removeAll { values.count >= $0.count }
        for waiter in ready {
            waiter.continuation.resume()
        }
    }

    func waitUntilCount(_ count: Int) async {
        guard values.count < count else { return }
        await withCheckedContinuation { continuation in
            waiters.append((count, continuation))
        }
    }

    func snapshot() -> [String?] {
        values
    }
}

private actor CustomStorageBox {
    private var session: StoredSession?

    func get() -> StoredSession? {
        session
    }

    func set(_ value: StoredSession) {
        session = value
    }

    func remove() {
        session = nil
    }
}

final class DecodedTokenTests: XCTestCase {
    func testDecodesJWTAndProcessesHasuraClaims() throws {
        let token = try testAccessToken(
            hasuraClaims: [
                "x-hasura-default-role": "user",
                "x-hasura-allowed-roles": "{user,editor}",
                "x-hasura-groups": "{\"team-a\",\"team,b\"}"
            ]
        )

        let decoded = try DecodedToken.decodeUserSession(token)

        XCTAssertEqual(decoded.issuer, "nhost-tests")
        XCTAssertEqual(decoded.subject, "user-1")
        XCTAssertEqual(decoded.exp?.timeIntervalSince1970, TimeInterval(testNowSeconds + 3_600))
        XCTAssertEqual(decoded.iat?.timeIntervalSince1970, TimeInterval(testNowSeconds))
        XCTAssertEqual(decoded.claims["exp"], .integer(Int64(testNowSeconds + 3_600) * 1_000))
        XCTAssertEqual(decoded.hasuraClaims?["x-hasura-default-role"], .string("user"))
        XCTAssertEqual(
            decoded.hasuraClaims?["x-hasura-allowed-roles"],
            .array([.string("user"), .string("editor")])
        )
        XCTAssertEqual(
            decoded.hasuraClaims?["x-hasura-groups"],
            .array([.string("team-a"), .string("team,b")])
        )
    }

    func testPostgresArrayPreservesWhitespaceInsideQuotedElements() throws {
        let token = try testAccessToken(
            hasuraClaims: ["x-hasura-groups": "{\" a \",\"b\"}"]
        )

        let decoded = try DecodedToken.decodeUserSession(token)

        XCTAssertEqual(
            decoded.hasuraClaims?["x-hasura-groups"],
            .array([.string(" a "), .string("b")])
        )
    }

    func testMalformedJWTThrows() {
        XCTAssertThrowsError(try DecodedToken.decodeUserSession("not-a-jwt")) { error in
            XCTAssertEqual(error as? NhostSessionError, .invalidAccessTokenFormat)
        }

        XCTAssertThrowsError(try DecodedToken.decodeUserSession("a.%%%%.c"))
    }
}

final class SessionStoreTests: XCTestCase {}

extension SessionStoreTests {
    func testMemoryStorageAndSubscriptions() async throws {
        let store = SessionStore(storage: MemorySessionStorageBackend())
        let recorder = SessionChangeRecorder()
        let subscription = store.subscribe { session in
            await recorder.append(session)
        }
        let first = try testAuthSession(accessToken: testAccessToken(exp: testNowSeconds + 60))

        let stored = try await store.set(first)
        let storedRefreshToken = try await store.get()?.refreshToken
        XCTAssertEqual(stored.accessToken, first.accessToken)
        XCTAssertEqual(storedRefreshToken, "refresh-token")

        try await store.remove()
        await recorder.waitUntilCount(2)
        let removedSession = try await store.get()
        let firstChanges = await recorder.snapshot()
        XCTAssertNil(removedSession)
        XCTAssertEqual(firstChanges, [first.accessToken, nil])

        await subscription.cancel()
        _ = try await store.set(try testAuthSession(accessToken: testAccessToken(exp: testNowSeconds + 120)))
        let changesAfterCancel = await recorder.snapshot()
        XCTAssertEqual(changesAfterCancel, [first.accessToken, nil])
    }

    func testSubscriptionAutomaticallyCancelsWhenFinalReferenceIsDropped() async throws {
        let store = SessionStore(storage: MemorySessionStorageBackend())
        let recorder = SessionChangeRecorder()
        var subscription: SessionStoreSubscription? = store.subscribe { session in
            await recorder.append(session)
        }

        XCTAssertNotNil(subscription)
        subscription = nil

        let deliveryFinished = CoordinationSignal()
        let deliverySubscription = store.subscribe { _ in
            await deliveryFinished.signal()
        }
        _ = try await store.set(try StoredSession(try testAuthSession()))
        await deliveryFinished.wait()

        let recordedChanges = await recorder.snapshot()
        XCTAssertTrue(recordedChanges.isEmpty)
        await deliverySubscription.cancel()
    }

    func testSubscriptionCancellationIsIdempotentAcrossConcurrentCallers() async {
        let recorder = SessionChangeRecorder()
        let subscription = SessionStoreSubscription(cancel: {
            await recorder.append(nil)
        })

        await withTaskGroup(of: Void.self) { group in
            for _ in 0..<10 {
                group.addTask {
                    await subscription.cancel()
                }
            }
        }

        let cancellations = await recorder.snapshot()
        XCTAssertEqual(cancellations.count, 1)
    }

    func testDroppingCustomSubscriptionRunsAsyncCancellation() async {
        let recorder = SessionChangeRecorder()
        var subscription: SessionStoreSubscription? = SessionStoreSubscription(cancel: {
            await recorder.append(nil)
        })

        XCTAssertNotNil(subscription)
        subscription = nil
        await recorder.waitUntilCount(1)

        let cancellations = await recorder.snapshot()
        XCTAssertEqual(cancellations.count, 1)
    }

    func testAuthorizationSnapshotsTrackGenerationsEpochsAndStableRefreshes() async throws {
        let initial = try StoredSession(
            try testAuthSession(
                accessToken: testAccessToken(exp: testNowSeconds + 60, iat: testNowSeconds)
            )
        )
        let backend = MemorySessionStorageBackend(session: initial)
        let store = SessionStore(storage: backend)

        let first = try await store.authorizationSnapshot()
        XCTAssertEqual(first.mutationGeneration, 0)
        XCTAssertEqual(first.authorizationEpoch, 0)
        XCTAssertEqual(first.session?.decodedToken.subject, "user-1")

        let refreshed = try StoredSession(
            try testAuthSession(
                exp: testNowSeconds + 3_600,
                accessToken: testAccessToken(exp: testNowSeconds + 3_600, iat: testNowSeconds + 30)
            )
        )
        _ = try await store.set(refreshed)
        let afterRefresh = try await store.authorizationSnapshot()
        XCTAssertEqual(afterRefresh.mutationGeneration, 1)
        XCTAssertEqual(afterRefresh.authorizationEpoch, 0)
        XCTAssertEqual(afterRefresh.stableFingerprint, first.stableFingerprint)

        let otherUser = try StoredSession(
            try testAuthSession(
                accessToken: testAccessToken(subject: "user-2")
            )
        )
        _ = try await store.set(otherUser)
        let afterUserSwitch = try await store.authorizationSnapshot()
        XCTAssertEqual(afterUserSwitch.mutationGeneration, 2)
        XCTAssertEqual(afterUserSwitch.authorizationEpoch, 1)
        XCTAssertNotEqual(afterUserSwitch.stableFingerprint, first.stableFingerprint)

        _ = try await store.set(refreshed)
        let afterABA = try await store.authorizationSnapshot()
        XCTAssertEqual(afterABA.mutationGeneration, 3)
        XCTAssertEqual(afterABA.authorizationEpoch, 2)
        XCTAssertEqual(afterABA.stableFingerprint, first.stableFingerprint)
    }

    func testAuthorizationSnapshotRereadsCustomBackendChanges() async throws {
        let initial = try StoredSession(try testAuthSession())
        let replacement = try StoredSession(
            try testAuthSession(accessToken: testAccessToken(subject: "external-user"))
        )
        let backend = MemorySessionStorageBackend(session: initial)
        let store = SessionStore(storage: backend)

        let first = try await store.authorizationSnapshot()
        try await backend.set(replacement)
        let second = try await store.authorizationSnapshot()

        XCTAssertEqual(second.mutationGeneration, 0)
        XCTAssertEqual(second.authorizationEpoch, first.authorizationEpoch + 1)
        XCTAssertEqual(second.session?.decodedToken.subject, "external-user")
    }

    func testAuthorizationSnapshotRemainsAtomicAcrossNotificationEnqueueReentrancy() async throws {
        let initial = try StoredSession(
            try testAuthSession(accessToken: testAccessToken(subject: "atomic-a"))
        )
        let external = try StoredSession(
            try testAuthSession(accessToken: testAccessToken(subject: "atomic-b"))
        )
        let backend = MemorySessionStorageBackend(session: initial)
        let enqueueEntered = CoordinationSignal()
        let enqueueRelease = CoordinationSignal()
        let store = SessionStore(
            storage: backend,
            coordinator: ProcessLocalSessionCoordinator(),
            beforeNotificationEnqueue: { sequence in
                guard sequence == 1 else { return }
                await enqueueEntered.signal()
                await enqueueRelease.wait()
            }
        )
        let initialSnapshot = try await store.authorizationSnapshot()
        let recorder = SessionTransitionRecorder()
        let subscription = store.subscribeToTransitions { old, new in
            await recorder.append(old: old, new: new)
        }

        try await backend.set(external)
        let externalSnapshotTask = Task { try await store.authorizationSnapshot() }
        await enqueueEntered.wait()

        _ = try await store.set(initial)
        await enqueueRelease.signal()

        let externalSnapshot = try await externalSnapshotTask.value
        let finalSnapshot = try await store.authorizationSnapshot()
        await recorder.waitUntilCount(2)
        let transitions = await recorder.snapshot()

        XCTAssertEqual(externalSnapshot.session?.decodedToken.subject, "atomic-b")
        XCTAssertEqual(externalSnapshot.mutationGeneration, 0)
        XCTAssertEqual(externalSnapshot.authorizationEpoch, initialSnapshot.authorizationEpoch + 1)
        XCTAssertEqual(externalSnapshot.stableFingerprint, external.stableAuthorizationFingerprint)
        XCTAssertEqual(finalSnapshot.session?.decodedToken.subject, "atomic-a")
        XCTAssertEqual(finalSnapshot.mutationGeneration, 1)
        XCTAssertEqual(finalSnapshot.authorizationEpoch, initialSnapshot.authorizationEpoch + 2)
        XCTAssertEqual(finalSnapshot.stableFingerprint, initial.stableAuthorizationFingerprint)
        XCTAssertEqual(transitions.count, 2)
        XCTAssertEqual(transitions[0].0, "atomic-a")
        XCTAssertEqual(transitions[0].1, "atomic-b")
        XCTAssertEqual(transitions[1].0, "atomic-b")
        XCTAssertEqual(transitions[1].1, "atomic-a")
        await subscription.cancel()
    }

    func testInternalTransitionObservationIncludesOldAndNewSessions() async throws {
        let initial = try StoredSession(try testAuthSession())
        let backend = MemorySessionStorageBackend(session: initial)
        let store = SessionStore(storage: backend)
        _ = try await store.authorizationSnapshot()
        let recorder = SessionTransitionRecorder()
        let subscription = store.subscribeToTransitions { old, new in
            await recorder.append(old: old, new: new)
        }
        let replacement = try StoredSession(
            try testAuthSession(accessToken: testAccessToken(subject: "user-2"))
        )

        _ = try await store.set(replacement)
        try await store.remove()
        await recorder.waitUntilCount(2)
        let transitions = await recorder.snapshot()

        XCTAssertEqual(transitions.count, 2)
        XCTAssertEqual(transitions[0].0, "user-1")
        XCTAssertEqual(transitions[0].1, "user-2")
        XCTAssertEqual(transitions[1].0, "user-2")
        XCTAssertNil(transitions[1].1)
        await subscription.cancel()
    }

    func testTransactionAcquiresExactlyOnceAndContextOperationsDoNotReacquire() async throws {
        let initial = try StoredSession(
            try testAuthSession(refreshToken: "refresh-a", refreshTokenId: "id-a")
        )
        let replacement = try StoredSession(
            try testAuthSession(
                accessToken: testAccessToken(subject: "user-2"),
                refreshToken: "refresh-b",
                refreshTokenId: "id-b"
            )
        )
        let coordinator = CountingSessionCoordinator()
        let store = SessionStore(
            storage: MemorySessionStorageBackend(session: initial),
            coordinator: coordinator
        )

        try await store.withTransaction { context in
            let storedCurrent = try await context.get()
            let current = try XCTUnwrap(storedCurrent)
            let replaced = try await context.set(
                replacement,
                ifRefreshTokenMatches: SessionRefreshTokenIdentity(current)
            )
            XCTAssertTrue(replaced)
            let staleRemoval = try await context.remove(
                ifRefreshTokenMatches: SessionRefreshTokenIdentity(current)
            )
            XCTAssertFalse(staleRemoval)
        }

        XCTAssertEqual(coordinator.count(), 1)
        let persisted = try await store.get()
        XCTAssertEqual(persisted?.refreshToken, "refresh-b")

        _ = try await store.set(initial)
        try await store.remove()
        XCTAssertEqual(coordinator.count(), 3)
    }

    func testNestedPublicMutationFailsImmediately() async throws {
        let store = SessionStore(
            storage: MemorySessionStorageBackend(),
            coordinator: ProcessLocalSessionCoordinator()
        )
        let session = try StoredSession(try testAuthSession())

        do {
            try await store.withTransaction { _ in
                _ = try await store.set(session)
            }
            XCTFail("nested acquisition must fail rather than deadlock")
        } catch {
            XCTAssertEqual(error as? SessionCoordinationError, .reentrantAcquisition)
        }
    }

    func testTransactionContextExpiresAfterLeaseRelease() async throws {
        let store = SessionStore(storage: MemorySessionStorageBackend())
        let box = SessionTransactionContextBox()

        try await store.withTransaction { context in
            await box.set(context)
            _ = try await context.get()
        }

        let retainedContext = await box.get()
        let context = try XCTUnwrap(retainedContext)
        do {
            _ = try await context.get()
            XCTFail("an escaped transaction context must be unusable")
        } catch {
            XCTAssertEqual(error as? SessionStoreTransactionError, .expiredLease)
        }
    }

    func testAuthorizationSnapshotRemainsResponsiveDuringHeldTransaction() async throws {
        let initial = try StoredSession(try testAuthSession())
        let store = SessionStore(storage: MemorySessionStorageBackend(session: initial))
        let entered = CoordinationSignal()
        let release = CoordinationSignal()

        let transaction = Task {
            try await store.withTransaction { context in
                _ = try await context.get()
                await entered.signal()
                await release.wait()
            }
        }
        await entered.wait()

        let snapshot = try await store.authorizationSnapshot()
        XCTAssertEqual(snapshot.session?.refreshToken, initial.refreshToken)

        await release.signal()
        try await transaction.value
    }

    func testAuthorizationSnapshotWaitsForCommitAndReturnsConsistentValue() async throws {
        let initial = try StoredSession(try testAuthSession())
        let replacement = try StoredSession(
            try testAuthSession(accessToken: testAccessToken(subject: "committed-user"))
        )
        let entered = CoordinationSignal()
        let release = CoordinationSignal()
        let backend = GatedCommitSessionBackend(
            session: initial,
            entered: entered,
            release: release
        )
        let store = SessionStore(storage: backend)
        _ = try await store.authorizationSnapshot()
        let commit = Task { try await store.set(replacement) }
        await entered.wait()
        let completion = SessionCompletionProbe()
        let snapshotTask = Task {
            let snapshot = try await store.authorizationSnapshot()
            await completion.complete()
            return snapshot
        }

        try await Task.sleep(nanoseconds: 50_000_000)
        let completedDuringCommit = await completion.value()
        XCTAssertFalse(completedDuringCommit)

        await release.signal()
        _ = try await commit.value
        let snapshot = try await snapshotTask.value
        XCTAssertEqual(snapshot.session?.decodedToken.subject, "committed-user")
    }

    func testCallbackMutationPreservesPerStoreOrderForMultipleSubscribers() async throws {
        let first = try StoredSession(
            try testAuthSession(accessToken: testAccessToken(subject: "ordered-a"))
        )
        let second = try StoredSession(
            try testAuthSession(accessToken: testAccessToken(subject: "ordered-b"))
        )
        let store = SessionStore(storage: MemorySessionStorageBackend(session: first))
        _ = try await store.authorizationSnapshot()
        let firstRecorder = SubjectRecorder()
        let secondRecorder = SubjectRecorder()
        let firstSubscription = store.subscribe { session in
            await firstRecorder.append(session)
            if session?.decodedToken.subject == "ordered-b" {
                _ = try? await store.set(first)
            }
        }
        let secondSubscription = store.subscribe { session in
            await secondRecorder.append(session)
        }

        _ = try await store.set(second)
        await firstRecorder.waitUntilCount(2)
        await secondRecorder.waitUntilCount(2)

        let firstValues = await firstRecorder.snapshot()
        let secondValues = await secondRecorder.snapshot()
        XCTAssertEqual(firstValues.compactMap { $0 }, ["ordered-b", "ordered-a"])
        XCTAssertEqual(secondValues.compactMap { $0 }, ["ordered-b", "ordered-a"])
        await firstSubscription.cancel()
        await secondSubscription.cancel()
    }

    func testDelayedPostReleaseEnqueueCannotInvertCommitOrder() async throws {
        let first = try StoredSession(
            try testAuthSession(accessToken: testAccessToken(subject: "enqueue-a"))
        )
        let second = try StoredSession(
            try testAuthSession(accessToken: testAccessToken(subject: "enqueue-b"))
        )
        let delayEntered = CoordinationSignal()
        let delayRelease = CoordinationSignal()
        let store = SessionStore(
            storage: MemorySessionStorageBackend(session: first),
            coordinator: ProcessLocalSessionCoordinator(),
            beforeNotificationEnqueue: { sequence in
                guard sequence == 1 else { return }
                await delayEntered.signal()
                await delayRelease.wait()
            }
        )
        _ = try await store.authorizationSnapshot()
        let recorder = SubjectRecorder()
        let subscription = store.subscribe { session in
            await recorder.append(session)
        }

        let firstMutation = Task { try await store.set(second) }
        await delayEntered.wait()
        _ = try await store.set(first)
        await delayRelease.signal()
        _ = try await firstMutation.value
        await recorder.waitUntilCount(2)

        let values = await recorder.snapshot()
        XCTAssertEqual(values.compactMap { $0 }, ["enqueue-b", "enqueue-a"])
        await subscription.cancel()
    }

    func testCancellationSuppressesCallbackThatHasNotStarted() async throws {
        let store = SessionStore(storage: MemorySessionStorageBackend())
        let firstEntered = CoordinationSignal()
        let firstRelease = CoordinationSignal()
        let drainFinished = CoordinationSignal()
        let cancelledRecorder = SubjectRecorder()
        let firstSubscription = store.subscribe { _ in
            await firstEntered.signal()
            await firstRelease.wait()
        }
        let cancelledSubscription = store.subscribe { session in
            await cancelledRecorder.append(session)
        }
        let finalSubscription = store.subscribe { _ in
            await drainFinished.signal()
        }

        _ = try await store.set(try StoredSession(try testAuthSession()))
        await firstEntered.wait()
        await cancelledSubscription.cancel()
        await firstRelease.signal()
        await drainFinished.wait()

        let cancelledValues = await cancelledRecorder.snapshot()
        XCTAssertTrue(cancelledValues.isEmpty)
        await firstSubscription.cancel()
        await finalSubscription.cancel()
    }

    func testIndependentStoreDiscoversSharedBackendMutationByReread() async throws {
        let first = try StoredSession(
            try testAuthSession(accessToken: testAccessToken(subject: "shared-a"))
        )
        let second = try StoredSession(
            try testAuthSession(accessToken: testAccessToken(subject: "shared-b"))
        )
        let backend = MemorySessionStorageBackend(session: first)
        let observingStore = SessionStore(storage: backend)
        let mutatingStore = SessionStore(storage: backend)
        _ = try await observingStore.authorizationSnapshot()
        let recorder = SessionTransitionRecorder()
        let subscription = observingStore.subscribeToTransitions { old, new in
            await recorder.append(old: old, new: new)
        }

        _ = try await mutatingStore.set(second)
        let reread = try await observingStore.authorizationSnapshot()
        XCTAssertEqual(reread.session?.decodedToken.subject, "shared-b")
        await recorder.waitUntilCount(1)
        let transitions = await recorder.snapshot()
        XCTAssertEqual(transitions.first?.0, "shared-a")
        XCTAssertEqual(transitions.first?.1, "shared-b")
        await subscription.cancel()
    }

    func testCustomStorageBackend() async throws {
        let box = CustomStorageBox()
        let backend = CustomSessionStorageBackend(
            get: { await box.get() },
            set: { await box.set($0) },
            remove: { await box.remove() }
        )
        let store = SessionStore(storage: backend)
        let session = try StoredSession(try testAuthSession())

        _ = try await store.set(session)
        let storedAccessToken = try await store.get()?.accessToken
        XCTAssertEqual(storedAccessToken, session.accessToken)

        try await store.remove()
        let removedSession = try await store.get()
        XCTAssertNil(removedSession)
    }

    #if !canImport(Security)
    func testDefaultStorageFallsBackToMemoryWhenKeychainUnavailable() {
        XCTAssertTrue(defaultSessionStorageBackend() is MemorySessionStorageBackend)
    }
    #endif
}
