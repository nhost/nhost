import Foundation
import XCTest
@testable import Nhost

private actor RefreshResponder {
    private var responses: [NhostRawResponse]
    private let delayNanoseconds: UInt64
    private var requests: [NhostRequest] = []

    init(responses: [NhostRawResponse], delayNanoseconds: UInt64 = 0) {
        self.responses = responses
        self.delayNanoseconds = delayNanoseconds
    }

    func respond(to request: NhostRequest) async throws -> NhostRawResponse {
        requests.append(request)

        if delayNanoseconds > 0 {
            try await Task.sleep(nanoseconds: delayNanoseconds)
        }

        if responses.isEmpty {
            return NhostRawResponse(status: 500)
        }

        return responses.removeFirst()
    }

    func count() -> Int {
        requests.count
    }

    func request(at index: Int = 0) -> NhostRequest? {
        guard requests.indices.contains(index) else { return nil }
        return requests[index]
    }
}

private func sessionResponse(_ session: AuthSession, status: Int = 200) throws -> NhostRawResponse {
    NhostRawResponse(
        status: status,
        headers: ["content-type": "application/json"],
        body: try NhostJSON.restEncoder.encode(session)
    )
}

private func errorResponse(status: Int) -> NhostRawResponse {
    NhostRawResponse(
        status: status,
        headers: ["content-type": "application/json"],
        body: Data(#"{"message":"refresh failed"}"#.utf8)
    )
}

final class SessionRefresherTests: XCTestCase {
    func testRefreshHonorsMarginAndForceRefresh() async throws {
        let initial = try StoredSession(try testAuthSession(exp: testNowSeconds + 3_600, refreshToken: "old-refresh"))
        let refreshedAuthSession = try testAuthSession(
            exp: testNowSeconds + 7_200,
            refreshToken: "new-refresh",
            refreshTokenId: "new-refresh-id"
        )
        let responder = try RefreshResponder(responses: [sessionResponse(refreshedAuthSession)])
        let store = SessionStore(storage: MemorySessionStorageBackend(session: initial))
        let auth = AuthClient(
            baseURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
            transport: StubTransport { request in try await responder.respond(to: request) }
        )
        let refresher = SessionRefresher(auth: auth, store: store) {
            Date(timeIntervalSince1970: TimeInterval(testNowSeconds))
        }

        let unchanged = await refresher.refreshSession(marginSeconds: 60)
        let countAfterMarginCheck = await responder.count()
        XCTAssertEqual(unchanged?.refreshToken, "old-refresh")
        XCTAssertEqual(countAfterMarginCheck, 0)

        let forced = await refresher.refreshSession(marginSeconds: 0)
        let storedRefreshToken = try await store.get()?.refreshToken
        let countAfterForceRefresh = await responder.count()
        XCTAssertEqual(forced?.refreshToken, "new-refresh")
        XCTAssertEqual(storedRefreshToken, "new-refresh")
        XCTAssertEqual(countAfterForceRefresh, 1)
    }

    func testRefreshRetriesExpiredSessionAndStoresSuccessfulRetry() async throws {
        let expired = try StoredSession(try testAuthSession(exp: testNowSeconds - 10, refreshToken: "old-refresh"))
        let refreshedAuthSession = try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "new-refresh",
            refreshTokenId: "new-refresh-id"
        )
        let responder = try RefreshResponder(responses: [errorResponse(status: 500), sessionResponse(refreshedAuthSession)])
        let store = SessionStore(storage: MemorySessionStorageBackend(session: expired))
        let auth = AuthClient(
            baseURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
            transport: StubTransport { request in try await responder.respond(to: request) }
        )
        let refresher = SessionRefresher(auth: auth, store: store) {
            Date(timeIntervalSince1970: TimeInterval(testNowSeconds))
        }

        let refreshed = await refresher.refreshSession(marginSeconds: 60)

        let storedRefreshToken = try await store.get()?.refreshToken
        let refreshCount = await responder.count()
        XCTAssertEqual(refreshed?.refreshToken, "new-refresh")
        XCTAssertEqual(storedRefreshToken, "new-refresh")
        XCTAssertEqual(refreshCount, 2)
    }

    func testRefreshClearsExpiredSessionAfterRetried401() async throws {
        let expired = try StoredSession(try testAuthSession(exp: testNowSeconds - 10, refreshToken: "old-refresh"))
        let responder = RefreshResponder(responses: [errorResponse(status: 401), errorResponse(status: 401)])
        let store = SessionStore(storage: MemorySessionStorageBackend(session: expired))
        let auth = AuthClient(
            baseURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
            transport: StubTransport { request in try await responder.respond(to: request) }
        )
        let refresher = SessionRefresher(auth: auth, store: store) {
            Date(timeIntervalSince1970: TimeInterval(testNowSeconds))
        }

        let refreshed = await refresher.refreshSession(marginSeconds: 60)

        let storedSession = try await store.get()
        let refreshCount = await responder.count()
        XCTAssertNil(refreshed)
        XCTAssertNil(storedSession)
        XCTAssertEqual(refreshCount, 2)
    }

    func testConcurrentRefreshIsSingleFlight() async throws {
        let expired = try StoredSession(try testAuthSession(exp: testNowSeconds - 10, refreshToken: "old-refresh"))
        let refreshedAuthSession = try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "new-refresh",
            refreshTokenId: "new-refresh-id"
        )
        let responder = try RefreshResponder(
            responses: [sessionResponse(refreshedAuthSession)],
            delayNanoseconds: 50_000_000
        )
        let store = SessionStore(storage: MemorySessionStorageBackend(session: expired))
        let auth = AuthClient(
            baseURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
            transport: StubTransport { request in try await responder.respond(to: request) }
        )
        let refresher = SessionRefresher(auth: auth, store: store) {
            Date(timeIntervalSince1970: TimeInterval(testNowSeconds))
        }

        let sessions = await withTaskGroup(of: StoredSession?.self) { group in
            for _ in 0..<8 {
                group.addTask {
                    await refresher.refreshSession(marginSeconds: 60)
                }
            }

            var values: [StoredSession?] = []
            for await value in group {
                values.append(value)
            }
            return values
        }

        let refreshCount = await responder.count()
        let refreshRequestPath = await responder.request()?.url.path
        XCTAssertEqual(sessions.count, 8)
        XCTAssertTrue(sessions.allSatisfy { $0?.refreshToken == "new-refresh" })
        XCTAssertEqual(refreshCount, 1)
        XCTAssertEqual(refreshRequestPath, "/v1/token")
    }
}
