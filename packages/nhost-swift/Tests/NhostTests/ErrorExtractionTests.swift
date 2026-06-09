import Foundation
import XCTest
@testable import Nhost

final class ErrorExtractionTests: XCTestCase {
    func testExtractsCommonMessageShapes() throws {
        let body = Data(
            #"{"message":"top","error":{"message":"nested"},"errors":[{"message":"first"},{"error":"second"}]}"#.utf8
        )

        let error = NhostHTTPError.decode(
            status: 400,
            headers: ["content-type": "application/json"],
            body: body
        )

        XCTAssertEqual(error.status, 400)
        XCTAssertEqual(error.headers["content-type"], "application/json")
        XCTAssertEqual(error.body?["message"]?.stringValue, "top")
        XCTAssertEqual(error.messages, ["top", "nested", "first", "second"])
    }

    func testFallsBackToStatusMessage() {
        let error = NhostHTTPError.decode(status: 503, headers: [:], body: Data())

        XCTAssertNil(error.body)
        XCTAssertEqual(error.messages, ["HTTP request failed with status 503"])
        XCTAssertEqual(FetchError.http(error).status, 503)
        XCTAssertEqual(FetchError.http(error).messages, error.messages)
    }
}
