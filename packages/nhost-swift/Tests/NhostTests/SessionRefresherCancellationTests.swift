import Foundation
import XCTest
@testable import Nhost

private actor RefreshCallbackState {
    private var released = false
    private var callbackObservedRelease: Bool?

    func markReleased() {
        released = true
    }

    func recordCallback() {
        callbackObservedRelease = released
    }

    func observedRelease() -> Bool? {
        callbackObservedRelease
    }
}

private struct RefreshCallbackTrackingCoordinator: SessionCoordinator {
    let base = ProcessLocalSessionCoordinator()
    let state: RefreshCallbackState

    func withCoordination<Result: Sendable>(
        _ operation: @Sendable () async throws -> Result
    ) async throws -> Result {
        do {
            let result = try await base.withCoordination(operation)
            await state.markReleased()
            return result
        } catch {
            await state.markReleased()
            throw error
        }
    }
}

private actor RefreshCompletionFlag {
    private var completed = false

    func markCompleted() {
        completed = true
    }

    func value() -> Bool {
        completed
    }
}

final class SessionRefresherCancellationTests: XCTestCase {
    func testRefreshCallbacksStartAfterCoordinationRelease() async throws {
        let expired = try StoredSession(try testAuthSession(exp: testNowSeconds - 1))
        let rotated = try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "rotated",
            refreshTokenId: "rotated-id"
        )
        let callbackState = RefreshCallbackState()
        let callbackSignal = CoordinationSignal()
        let coordinator = RefreshCallbackTrackingCoordinator(state: callbackState)
        let store = SessionStore(
            storage: MemorySessionStorageBackend(session: expired),
            coordinator: coordinator
        )
        let subscription = store.subscribe { _ in
            await callbackState.recordCallback()
            await callbackSignal.signal()
        }
        let responder = try RefreshResponder(outcomes: [.response(refreshSessionResponse(rotated))])
        let refresher = try makeRefresher(store: store, responder: responder)

        _ = try await refresher.refreshSession()
        await callbackSignal.wait()

        let observed = await callbackState.observedRelease()
        XCTAssertEqual(observed, true)
        await subscription.cancel()
    }

    func testCancellationIgnoringTransportRetainsOwnershipUntilReturn() async throws {
        let expired = try StoredSession(try testAuthSession(exp: testNowSeconds - 1))
        let coordinator = ProcessLocalSessionCoordinator()
        let store = SessionStore(
            storage: MemorySessionStorageBackend(session: expired),
            coordinator: coordinator
        )
        let started = CoordinationSignal()
        let release = CoordinationSignal()
        let completion = RefreshCompletionFlag()
        let auth = AuthClient(
            baseURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
            transport: StubTransport { _ in
                await started.signal()
                await release.wait()
                throw FetchError.transport("ignored cancellation")
            }
        )
        let refresher = SessionRefresher(auth: auth, store: store) {
            Date(timeIntervalSince1970: TimeInterval(testNowSeconds))
        }

        let refreshTask = Task {
            try await refresher.refreshSession()
        }
        await started.wait()
        refreshTask.cancel()
        let competitor = Task {
            _ = try await coordinator.withCoordination {
                await completion.markCompleted()
            }
        }
        try await Task.sleep(nanoseconds: 20_000_000)
        let completedWhileTransportBlocked = await completion.value()
        XCTAssertFalse(completedWhileTransportBlocked)

        await release.signal()
        do {
            _ = try await refreshTask.value
            XCTFail("Expected cancellation")
        } catch is CancellationError {
            // Expected.
        }
        _ = try await competitor.value
        let completedAfterReturn = await completion.value()
        XCTAssertTrue(completedAfterReturn)
    }
}
