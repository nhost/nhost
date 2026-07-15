import Foundation
import XCTest
@testable import Nhost

final class SessionRefresherTimeoutTests: XCTestCase {
    func testRawTransportTimeoutRetriesOnce() async throws {
        let expired = try StoredSession(try testAuthSession(exp: testNowSeconds - 1))
        let rotated = try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "rotated",
            refreshTokenId: "rotated-id"
        )
        let responder = try RefreshResponder(outcomes: [
            .timeout,
            .response(refreshSessionResponse(rotated))
        ])
        let store = SessionStore(storage: MemorySessionStorageBackend(session: expired))
        let refresher = try makeRefresher(store: store, responder: responder)

        let result = try await refresher.refreshSession()

        XCTAssertEqual(result?.refreshToken, "rotated")
        let count = await responder.count()
        XCTAssertEqual(count, 2)
    }
}
