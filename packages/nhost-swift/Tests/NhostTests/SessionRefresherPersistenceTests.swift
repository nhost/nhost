import Foundation
import XCTest
@testable import Nhost

private enum PersistenceTestError: Error, Sendable {
    case storage
}

private enum PersistenceWriteBehavior: Sendable {
    case succeed
    case fail
    case commitThenFail
    case replaceThenFail(StoredSession)
    case failAndBecomeUnreadable
}

private struct PersistenceSnapshot: Sendable {
    let session: StoredSession?
    let sets: Int
    let removes: Int
}

private actor ScriptedPersistenceBackend: SessionStorageBackend {
    private var session: StoredSession?
    private var writes: [PersistenceWriteBehavior]
    private var unreadable = false
    private var setCount = 0
    private var removeCount = 0

    init(session: StoredSession?, writes: [PersistenceWriteBehavior]) {
        self.session = session
        self.writes = writes
    }

    func get() async throws -> StoredSession? {
        if unreadable {
            throw PersistenceTestError.storage
        }
        return session
    }

    func set(_ value: StoredSession) async throws {
        setCount += 1
        let behavior = writes.isEmpty ? .succeed : writes.removeFirst()
        switch behavior {
        case .succeed:
            session = value
        case .fail:
            throw PersistenceTestError.storage
        case .commitThenFail:
            session = value
            throw PersistenceTestError.storage
        case let .replaceThenFail(replacement):
            session = replacement
            throw PersistenceTestError.storage
        case .failAndBecomeUnreadable:
            unreadable = true
            throw PersistenceTestError.storage
        }
    }

    func remove() async throws {
        removeCount += 1
        session = nil
    }

    func snapshot() -> PersistenceSnapshot {
        PersistenceSnapshot(session: session, sets: setCount, removes: removeCount)
    }
}

private struct PersistenceFixture {
    let refresher: SessionRefresher
    let backend: ScriptedPersistenceBackend
    let responder: RefreshResponder
}

final class SessionRefresherPersistenceTests: XCTestCase {
    func testAmbiguousPersistenceSuccessIsAcceptedAfterReread() async throws {
        let fixture = try persistenceFixture(writes: [.commitThenFail])

        let result = try await fixture.refresher.refreshSession()

        XCTAssertEqual(result?.refreshToken, "rotated")
        let snapshot = await fixture.backend.snapshot()
        XCTAssertEqual(snapshot.session?.refreshToken, "rotated")
        XCTAssertEqual(snapshot.sets, 1)
    }

    func testPersistenceRetriesStorageOnlyOnce() async throws {
        let fixture = try persistenceFixture(writes: [.fail, .succeed])

        let result = try await fixture.refresher.refreshSession()

        XCTAssertEqual(result?.refreshToken, "rotated")
        let snapshot = await fixture.backend.snapshot()
        XCTAssertEqual(snapshot.sets, 2)
        let requests = await fixture.responder.count()
        XCTAssertEqual(requests, 1)
    }

    func testPersistenceFailureClearsExactConsumedTokenAndThrowsTypedError() async throws {
        let fixture = try persistenceFixture(writes: [.fail, .fail])

        try await assertPersistenceFailure(fixture.refresher)

        let snapshot = await fixture.backend.snapshot()
        XCTAssertNil(snapshot.session)
        XCTAssertEqual(snapshot.sets, 2)
        XCTAssertEqual(snapshot.removes, 1)
    }

    func testPersistenceFailurePreservesReplacement() async throws {
        let replacement = try StoredSession(try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "replacement",
            refreshTokenId: "replacement-id"
        ))
        let fixture = try persistenceFixture(writes: [.replaceThenFail(replacement)])

        try await assertPersistenceFailure(fixture.refresher)

        let snapshot = await fixture.backend.snapshot()
        XCTAssertEqual(snapshot.session?.refreshToken, "replacement")
        XCTAssertEqual(snapshot.sets, 1)
        XCTAssertEqual(snapshot.removes, 0)
    }

    func testUnreadableBackendAfterRotationIsNotClearedOrRetried() async throws {
        let fixture = try persistenceFixture(writes: [.failAndBecomeUnreadable])

        try await assertPersistenceFailure(fixture.refresher)

        let snapshot = await fixture.backend.snapshot()
        XCTAssertEqual(snapshot.session?.refreshToken, "consumed")
        XCTAssertEqual(snapshot.sets, 1)
        XCTAssertEqual(snapshot.removes, 0)
    }

    func testPublicDirectRefreshClearsConsumedTokenAndThrowsTypedPersistenceError() async throws {
        let consumed = try StoredSession(try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "consumed-direct-token",
            refreshTokenId: "consumed-direct-id"
        ))
        let rotated = try testAuthSession(
            exp: testNowSeconds + 1_200,
            refreshToken: "rotated-direct-token",
            refreshTokenId: "rotated-direct-id"
        )
        let backend = ScriptedPersistenceBackend(session: consumed, writes: [.fail, .fail])
        let transport = ManagedRecordingTransport { request in
            XCTAssertEqual(request.url.path, "/v1/token")
            return NhostRawResponse(
                status: 200,
                headers: ["content-type": "application/json"],
                body: try NhostJSON.restEncoder.encode(rotated)
            )
        }
        let client = createClient(
            NhostClientOptions(
                authURL: managedAuthTestBaseURL,
                sessionManagement: .processLocal(storage: backend),
                transport: transport
            )
        )

        do {
            _ = try await client.auth.refreshToken(
                body: AuthRefreshTokenRequest(refreshToken: consumed.refreshToken)
            )
            XCTFail("Expected typed persistence failure")
        } catch let error as SessionRefreshError {
            XCTAssertEqual(error, .persistenceAfterRotation)
        }

        let snapshot = await backend.snapshot()
        let requests = await transport.requests()
        XCTAssertNil(snapshot.session)
        XCTAssertEqual(snapshot.sets, 2)
        XCTAssertEqual(snapshot.removes, 1)
        XCTAssertEqual(requests.count, 1)
    }

    private func assertPersistenceFailure(_ refresher: SessionRefresher) async throws {
        do {
            _ = try await refresher.refreshSession()
            XCTFail("Expected typed persistence failure")
        } catch let error as SessionRefreshError {
            XCTAssertEqual(error, .persistenceAfterRotation)
        }
    }

    private func persistenceFixture(
        writes: [PersistenceWriteBehavior]
    ) throws -> PersistenceFixture {
        let expired = try StoredSession(try testAuthSession(
            exp: testNowSeconds - 1,
            refreshToken: "consumed",
            refreshTokenId: "consumed-id"
        ))
        let rotated = try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "rotated",
            refreshTokenId: "rotated-id"
        )
        let backend = ScriptedPersistenceBackend(session: expired, writes: writes)
        let responder = try RefreshResponder(outcomes: [.response(refreshSessionResponse(rotated))])
        let store = SessionStore(storage: backend)
        return PersistenceFixture(
            refresher: try makeRefresher(store: store, responder: responder),
            backend: backend,
            responder: responder
        )
    }
}
