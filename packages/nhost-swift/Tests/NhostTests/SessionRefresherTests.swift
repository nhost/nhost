import Foundation
import XCTest
@testable import Nhost

private enum SessionReadTestError: Error {
    case storage
}

enum RefreshOutcome: Sendable {
    case response(NhostRawResponse)
    case transportFailure
    case timeout
    case cancellation
}

actor RefreshResponder {
    private var outcomes: [RefreshOutcome]
    private let delayNanoseconds: UInt64
    private let beforeResponse: (@Sendable (Int) async -> Void)?
    private var requests: [NhostRequest] = []

    init(
        outcomes: [RefreshOutcome],
        delayNanoseconds: UInt64 = 0,
        beforeResponse: (@Sendable (Int) async -> Void)? = nil
    ) {
        self.outcomes = outcomes
        self.delayNanoseconds = delayNanoseconds
        self.beforeResponse = beforeResponse
    }

    func respond(to request: NhostRequest) async throws -> NhostRawResponse {
        requests.append(request)
        let requestIndex = requests.count - 1
        if delayNanoseconds > 0 {
            try await Task.sleep(nanoseconds: delayNanoseconds)
        }
        await beforeResponse?(requestIndex)

        guard !outcomes.isEmpty else {
            return refreshErrorResponse(status: 500)
        }
        switch outcomes.removeFirst() {
        case let .response(response):
            return response
        case .transportFailure:
            throw FetchError.transport("test transport failure")
        case .timeout:
            throw URLError(.timedOut)
        case .cancellation:
            throw CancellationError()
        }
    }

    func count() -> Int {
        requests.count
    }

    func request(at index: Int = 0) -> NhostRequest? {
        guard requests.indices.contains(index) else { return nil }
        return requests[index]
    }
}

private actor RefreshSleepRecorder {
    private var delays: [TimeInterval] = []

    func sleep(_ delay: TimeInterval) {
        delays.append(delay)
    }

    func values() -> [TimeInterval] {
        delays
    }
}

func refreshSessionResponse(_ session: AuthSession) throws -> NhostRawResponse {
    NhostRawResponse(
        status: 200,
        headers: ["content-type": "application/json"],
        body: try NhostJSON.restEncoder.encode(session)
    )
}

func refreshErrorResponse(
    status: Int,
    headers: [String: String] = [:],
    error: AuthErrorResponseError? = nil
) -> NhostRawResponse {
    let body: Data
    if let error {
        body = (try? NhostJSON.restEncoder.encode(
            AuthErrorResponse(status: status, message: "refresh failed", error: error)
        )) ?? Data()
    } else {
        body = Data(#"{"message":"refresh failed"}"#.utf8)
    }
    var responseHeaders = headers
    responseHeaders["content-type"] = "application/json"
    return NhostRawResponse(status: status, headers: responseHeaders, body: body)
}

func makeRefresher(
    store: SessionStore,
    responder: RefreshResponder,
    sleeper: SessionRefreshSleeper? = nil
) throws -> SessionRefresher {
    let auth = AuthClient(
        baseURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
        transport: StubTransport { request in try await responder.respond(to: request) }
    )
    if let sleeper {
        return SessionRefresher(
            auth: auth,
            store: store,
            now: { Date(timeIntervalSince1970: TimeInterval(testNowSeconds)) },
            sleeper: sleeper
        )
    }
    return SessionRefresher(auth: auth, store: store) {
        Date(timeIntervalSince1970: TimeInterval(testNowSeconds))
    }
}

final class SessionRefresherTests: XCTestCase {
    func testNilMeansAbsentWhileStorageReadFailureThrows() async throws {
        let absentResponder = RefreshResponder(outcomes: [])
        let absentStore = SessionStore(storage: MemorySessionStorageBackend())
        let absentRefresher = try makeRefresher(store: absentStore, responder: absentResponder)

        let result = try await absentRefresher.refreshSession()
        XCTAssertNil(result)
        let absentRequests = await absentResponder.count()
        XCTAssertEqual(absentRequests, 0)

        let failingBackend = CustomSessionStorageBackend(
            get: { throw SessionReadTestError.storage },
            set: { _ in },
            remove: {}
        )
        let failingResponder = RefreshResponder(outcomes: [])
        let failingRefresher = try makeRefresher(
            store: SessionStore(storage: failingBackend),
            responder: failingResponder
        )
        do {
            _ = try await failingRefresher.refreshSession()
            XCTFail("Expected storage read failure")
        } catch is SessionReadTestError {
            // Expected.
        }
    }

    func testRefreshHonorsMarginAndForceRefresh() async throws {
        let initial = try StoredSession(try testAuthSession(
            exp: testNowSeconds + 3_600,
            refreshToken: "old-refresh"
        ))
        let rotated = try testAuthSession(
            exp: testNowSeconds + 7_200,
            refreshToken: "new-refresh",
            refreshTokenId: "new-refresh-id"
        )
        let responder = try RefreshResponder(outcomes: [.response(refreshSessionResponse(rotated))])
        let store = SessionStore(storage: MemorySessionStorageBackend(session: initial))
        let refresher = try makeRefresher(store: store, responder: responder)

        let unchanged = try await refresher.refreshSession(marginSeconds: 60)
        XCTAssertEqual(unchanged?.refreshToken, "old-refresh")
        let countAfterMargin = await responder.count()
        XCTAssertEqual(countAfterMargin, 0)

        let forced = try await refresher.refreshSession(marginSeconds: 0)
        XCTAssertEqual(forced?.refreshToken, "new-refresh")
        let stored = try await store.get()
        let finalCount = await responder.count()
        XCTAssertEqual(stored?.refreshToken, "new-refresh")
        XCTAssertEqual(finalCount, 1)
    }

    func testIndependentStoresOverOneFileLockConsumeOriginalTokenOnce() async throws {
        let expired = try StoredSession(try testAuthSession(
            exp: testNowSeconds - 10,
            refreshToken: "old-refresh"
        ))
        let rotated = try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "new-refresh",
            refreshTokenId: "new-refresh-id"
        )
        let backend = MemorySessionStorageBackend(session: expired)
        let lockURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("nhost-refresh-\(UUID().uuidString).lock")
        defer { try? FileManager.default.removeItem(at: lockURL) }
        let firstStore = SessionStore(
            storage: backend,
            coordinator: FileSessionCoordinator(lockFileURL: lockURL, acquisitionTimeout: 2)
        )
        let secondStore = SessionStore(
            storage: backend,
            coordinator: FileSessionCoordinator(lockFileURL: lockURL, acquisitionTimeout: 2)
        )
        let responder = try RefreshResponder(
            outcomes: [.response(refreshSessionResponse(rotated))],
            delayNanoseconds: 50_000_000
        )
        let first = try makeRefresher(store: firstStore, responder: responder)
        let second = try makeRefresher(store: secondStore, responder: responder)

        async let firstResult = first.refreshSession(marginSeconds: 60)
        async let secondResult = second.refreshSession(marginSeconds: 60)
        let results = try await [firstResult, secondResult]

        XCTAssertTrue(results.allSatisfy { $0?.refreshToken == "new-refresh" })
        let requestCount = await responder.count()
        XCTAssertEqual(requestCount, 1)
        let recordedRequest = await responder.request()
        let body = try XCTUnwrap(recordedRequest?.body)
        let request = try NhostJSON.restDecoder.decode(AuthRefreshTokenRequest.self, from: body)
        XCTAssertEqual(request.refreshToken, "old-refresh")
    }

    func testExactInvalidRefreshTokenClearsAndThrowsWithoutRetry() async throws {
        let expired = try StoredSession(try testAuthSession(
            exp: testNowSeconds - 10,
            refreshToken: "rejected"
        ))
        let responder = RefreshResponder(outcomes: [
            .response(refreshErrorResponse(status: 401, error: .invalidRefreshToken))
        ])
        let store = SessionStore(storage: MemorySessionStorageBackend(session: expired))
        let refresher = try makeRefresher(store: store, responder: responder)

        do {
            _ = try await refresher.refreshSession()
            XCTFail("Expected invalid refresh token to throw")
        } catch let error as FetchError {
            XCTAssertEqual(error.decodedBody(AuthErrorResponse.self)?.error, .invalidRefreshToken)
        }

        let stored = try await store.get()
        let count = await responder.count()
        XCTAssertNil(stored)
        XCTAssertEqual(count, 1)
    }

    func testStaleInvalidResponsePreservesAndReassessesReplacement() async throws {
        let rejected = try StoredSession(try testAuthSession(
            exp: testNowSeconds - 10,
            refreshToken: "rejected"
        ))
        let replacement = try StoredSession(try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "replacement",
            refreshTokenId: "replacement-id"
        ))
        let backend = MemorySessionStorageBackend(session: rejected)
        let responder = RefreshResponder(
            outcomes: [.response(refreshErrorResponse(status: 401, error: .invalidRefreshToken))],
            beforeResponse: { index in
                if index == 0 {
                    try? await backend.set(replacement)
                }
            }
        )
        let store = SessionStore(storage: backend)
        let refresher = try makeRefresher(store: store, responder: responder)

        let result = try await refresher.refreshSession()

        XCTAssertEqual(result?.refreshToken, "replacement")
        let stored = try await store.get()
        XCTAssertEqual(stored?.refreshToken, "replacement")
        let count = await responder.count()
        XCTAssertEqual(count, 1)
    }

    func testUnrelatedAndUndecodableUnauthorizedResponsesAreNonDestructive() async throws {
        for response in [
            refreshErrorResponse(status: 401, error: .invalidRequest),
            refreshErrorResponse(status: 401)
        ] {
            let expired = try StoredSession(try testAuthSession(
                exp: testNowSeconds - 10,
                refreshToken: UUID().uuidString
            ))
            let responder = RefreshResponder(outcomes: [.response(response)])
            let store = SessionStore(storage: MemorySessionStorageBackend(session: expired))
            let refresher = try makeRefresher(store: store, responder: responder)

            do {
                _ = try await refresher.refreshSession()
                XCTFail("Expected unauthorized refresh to throw")
            } catch let error as FetchError {
                XCTAssertEqual(error.status, 401)
            }
            let stored = try await store.get()
            XCTAssertEqual(stored?.refreshToken, expired.refreshToken)
            let count = await responder.count()
            XCTAssertEqual(count, 1)
        }
    }

    func testRetryableFailuresUseOneTotalRetryAndUnexpiredFallback() async throws {
        let nearExpiry = try StoredSession(try testAuthSession(
            exp: testNowSeconds + 30,
            refreshToken: "current"
        ))
        let responder = RefreshResponder(outcomes: [
            .transportFailure,
            .response(refreshErrorResponse(status: 503)),
            .response(refreshErrorResponse(status: 503))
        ])
        let store = SessionStore(storage: MemorySessionStorageBackend(session: nearExpiry))
        let refresher = try makeRefresher(store: store, responder: responder)

        let result = try await refresher.refreshSession(marginSeconds: 60)

        XCTAssertEqual(result?.refreshToken, "current")
        let count = await responder.count()
        XCTAssertEqual(count, 2)
    }

    func testExpiredTransientFailureThrowsAfterOneRetry() async throws {
        let expired = try StoredSession(try testAuthSession(exp: testNowSeconds - 1))
        let responder = RefreshResponder(outcomes: [
            .response(refreshErrorResponse(status: 408)),
            .response(refreshErrorResponse(status: 500))
        ])
        let store = SessionStore(storage: MemorySessionStorageBackend(session: expired))
        let refresher = try makeRefresher(store: store, responder: responder)

        do {
            _ = try await refresher.refreshSession()
            XCTFail("Expected expired transient failure to throw")
        } catch let error as FetchError {
            XCTAssertEqual(error.status, 500)
        }
        let count = await responder.count()
        XCTAssertEqual(count, 2)
    }

    func testRetryAfterIsCaseInsensitiveAndRespectsOneSecondCap() async throws {
        let expired = try StoredSession(try testAuthSession(exp: testNowSeconds - 1))
        let rotated = try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "rotated",
            refreshTokenId: "rotated-id"
        )
        let sleepRecorder = RefreshSleepRecorder()
        let retryingResponder = try RefreshResponder(outcomes: [
            .response(refreshErrorResponse(status: 429, headers: ["rEtRy-AfTeR": "0.25"])),
            .response(refreshSessionResponse(rotated))
        ])
        let retryingStore = SessionStore(storage: MemorySessionStorageBackend(session: expired))
        let retryingRefresher = try makeRefresher(
            store: retryingStore,
            responder: retryingResponder,
            sleeper: { delay in await sleepRecorder.sleep(delay) }
        )

        _ = try await retryingRefresher.refreshSession()
        let delays = await sleepRecorder.values()
        XCTAssertEqual(delays, [0.25])
        let retryingCount = await retryingResponder.count()
        XCTAssertEqual(retryingCount, 2)

        let cappedResponder = RefreshResponder(outcomes: [
            .response(refreshErrorResponse(status: 429, headers: ["Retry-After": "1.01"]))
        ])
        let cappedStore = SessionStore(storage: MemorySessionStorageBackend(session: expired))
        let cappedRefresher = try makeRefresher(store: cappedStore, responder: cappedResponder)
        do {
            _ = try await cappedRefresher.refreshSession()
            XCTFail("Expected over-cap Retry-After to throw")
        } catch let error as FetchError {
            XCTAssertEqual(error.status, 429)
        }
        let cappedCount = await cappedResponder.count()
        XCTAssertEqual(cappedCount, 1)
    }

    func testCancellationIsNeverRetried() async throws {
        let expired = try StoredSession(try testAuthSession(exp: testNowSeconds - 1))
        let responder = RefreshResponder(outcomes: [.cancellation, .transportFailure])
        let store = SessionStore(storage: MemorySessionStorageBackend(session: expired))
        let refresher = try makeRefresher(store: store, responder: responder)

        do {
            _ = try await refresher.refreshSession()
            XCTFail("Expected cancellation")
        } catch is CancellationError {
            // Expected.
        }
        let count = await responder.count()
        XCTAssertEqual(count, 1)
    }
}
