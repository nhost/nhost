import Foundation
import XCTest
@testable import NhostSwiftToolchainSmoke

final class SmokeTests: XCTestCase {
    func testFoundationAndXCTest() {
        let smoke = Smoke(value: "swift-6")

        XCTAssertEqual(smoke.value, "swift-6")
        XCTAssertEqual(smoke.epoch.timeIntervalSince1970, 0)
    }
}
