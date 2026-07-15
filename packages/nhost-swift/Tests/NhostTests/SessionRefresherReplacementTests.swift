import Foundation
import XCTest
@testable import Nhost

final class SessionRefresherReplacementTests: XCTestCase {
    func testStaleInvalidResponseRefreshesExpiredReplacementAtMostOnce() async throws {
        let rejected = try StoredSession(try testAuthSession(
            exp: testNowSeconds - 10,
            refreshToken: "rejected",
            refreshTokenId: "rejected-id"
        ))
        let replacement = try StoredSession(try testAuthSession(
            exp: testNowSeconds - 5,
            refreshToken: "replacement",
            refreshTokenId: "replacement-id"
        ))
        let rotated = try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "rotated",
            refreshTokenId: "rotated-id"
        )
        let backend = MemorySessionStorageBackend(session: rejected)
        let responder = try RefreshResponder(
            outcomes: [
                .response(refreshErrorResponse(status: 401, error: .invalidRefreshToken)),
                .response(refreshSessionResponse(rotated))
            ],
            beforeResponse: { index in
                if index == 0 {
                    try? await backend.set(replacement)
                }
            }
        )
        let store = SessionStore(storage: backend)
        let refresher = try makeRefresher(store: store, responder: responder)

        let result = try await refresher.refreshSession()

        XCTAssertEqual(result?.refreshToken, "rotated")
        let count = await responder.count()
        XCTAssertEqual(count, 2)
        let firstRecorded = await responder.request(at: 0)
        let secondRecorded = await responder.request(at: 1)
        let firstBody = try XCTUnwrap(firstRecorded?.body)
        let secondBody = try XCTUnwrap(secondRecorded?.body)
        let first = try NhostJSON.restDecoder.decode(AuthRefreshTokenRequest.self, from: firstBody)
        let second = try NhostJSON.restDecoder.decode(AuthRefreshTokenRequest.self, from: secondBody)
        XCTAssertEqual(first.refreshToken, "rejected")
        XCTAssertEqual(second.refreshToken, "replacement")
    }
}
