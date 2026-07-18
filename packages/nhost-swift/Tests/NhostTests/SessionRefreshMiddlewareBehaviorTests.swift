import Foundation
import XCTest
@testable import Nhost

private actor SessionRefreshMiddlewareRecorder {
    private var requests: [NhostRequest] = []

    func record(_ request: NhostRequest) {
        requests.append(request)
    }

    func firstRequest() -> NhostRequest? {
        requests.first
    }
}

private actor SessionRefreshMiddlewareCallCounter {
    private var value = 0

    func increment() {
        value += 1
    }

    func count() -> Int {
        value
    }
}

private enum MiddlewareCoordinationFailure: Sendable {
    case coordination(SessionCoordinationError)
    case cancellation
}

private struct FailingMiddlewareCoordinator: SessionCoordinator {
    let failure: MiddlewareCoordinationFailure

    func withCoordination<Result: Sendable>(
        _ operation: @Sendable () async throws -> Result
    ) async throws -> Result {
        switch failure {
        case let .coordination(error):
            throw error
        case .cancellation:
            throw CancellationError()
        }
    }
}

final class SessionRefreshMiddlewareBehaviorTests: XCTestCase {
    func testCoordinationFailuresStopOrdinaryRequestBeforeNext() async throws {
        let failures: [MiddlewareCoordinationFailure] = [
            .coordination(.timedOut),
            .coordination(.systemCallFailed(operation: "open", code: 5)),
            .cancellation
        ]

        for failure in failures {
            let expired = try StoredSession(try testAuthSession(exp: testNowSeconds - 10))
            let store = SessionStore(
                storage: MemorySessionStorageBackend(session: expired),
                coordinator: FailingMiddlewareCoordinator(failure: failure)
            )
            let refreshAuth = AuthClient(
                baseURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
                transport: StubTransport { _ in
                    XCTFail("refresh transport must not run")
                    return NhostRawResponse(status: 500)
                }
            )
            let refresher = SessionRefresher(auth: refreshAuth, store: store) {
                Date(timeIntervalSince1970: TimeInterval(testNowSeconds))
            }
            let nextCalls = SessionRefreshMiddlewareCallCounter()
            let pipeline = NhostFetchPipeline(
                transport: StubTransport { _ in
                    await nextCalls.increment()
                    return NhostRawResponse(status: 204)
                },
                middleware: [sessionRefreshMiddleware(refresher: refresher)]
            )

            do {
                _ = try await pipeline.send(ordinaryRequest())
                XCTFail("Expected coordination failure")
            } catch {
                XCTAssertTrue(error is SessionCoordinationError || error is CancellationError)
            }
            let count = await nextCalls.count()
            XCTAssertEqual(count, 0)
        }
    }

    func testExpiredRefreshFailureStopsOrdinaryRequestBeforeNext() async throws {
        let expired = try StoredSession(try testAuthSession(exp: testNowSeconds - 10))
        let store = SessionStore(storage: MemorySessionStorageBackend(session: expired))
        let responder = RefreshResponder(outcomes: [
            .response(refreshErrorResponse(status: 500)),
            .response(refreshErrorResponse(status: 500))
        ])
        let refresher = try makeRefresher(store: store, responder: responder)
        let nextCalls = SessionRefreshMiddlewareCallCounter()
        let pipeline = NhostFetchPipeline(
            transport: StubTransport { _ in
                await nextCalls.increment()
                return NhostRawResponse(status: 204)
            },
            middleware: [sessionRefreshMiddleware(refresher: refresher)]
        )

        do {
            _ = try await pipeline.send(ordinaryRequest())
            XCTFail("Expected expired refresh failure")
        } catch let error as FetchError {
            XCTAssertEqual(error.status, 500)
        }
        let count = await nextCalls.count()
        XCTAssertEqual(count, 0)
    }

    func testUnexpiredTransientRefreshFailureProceedsWithCurrentToken() async throws {
        let current = try StoredSession(try testAuthSession(exp: testNowSeconds + 30))
        let store = SessionStore(storage: MemorySessionStorageBackend(session: current))
        let responder = RefreshResponder(outcomes: [
            .response(refreshErrorResponse(status: 503)),
            .response(refreshErrorResponse(status: 503))
        ])
        let refresher = try makeRefresher(store: store, responder: responder)
        let recorder = SessionRefreshMiddlewareRecorder()
        let pipeline = NhostFetchPipeline(
            transport: StubTransport { request in
                await recorder.record(request)
                return NhostRawResponse(status: 204)
            },
            middleware: [
                sessionRefreshMiddleware(refresher: refresher),
                attachAccessTokenMiddleware(sessionStore: store)
            ]
        )

        _ = try await pipeline.send(ordinaryRequest())

        let request = await recorder.firstRequest()
        XCTAssertEqual(request?.headers["authorization"], "Bearer \(current.accessToken)")
    }

    func testOrdinaryDownstreamRequestRunsAfterRefreshOwnershipIsReleased() async throws {
        let expired = try StoredSession(try testAuthSession(exp: testNowSeconds - 10))
        let rotated = try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "rotated",
            refreshTokenId: "rotated-id"
        )
        let coordinator = ProcessLocalSessionCoordinator()
        let store = SessionStore(
            storage: MemorySessionStorageBackend(session: expired),
            coordinator: coordinator
        )
        let responder = try RefreshResponder(outcomes: [.response(refreshSessionResponse(rotated))])
        let refresher = try makeRefresher(store: store, responder: responder)
        let pipeline = NhostFetchPipeline(
            transport: StubTransport { _ in
                try await coordinator.withCoordination { NhostRawResponse(status: 204) }
            },
            middleware: [
                sessionRefreshMiddleware(refresher: refresher),
                attachAccessTokenMiddleware(sessionStore: store)
            ]
        )

        let response = try await pipeline.send(ordinaryRequest())
        XCTAssertEqual(response.status, 204)
    }

    private func ordinaryRequest() throws -> NhostRequest {
        NhostRequest(
            method: "GET",
            url: try XCTUnwrap(URL(string: "https://graphql.example.test/v1"))
        )
    }
}
