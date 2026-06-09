import Foundation
import XCTest
@testable import Nhost

final class JSONValueTests: XCTestCase {
    func testRoundTrip() throws {
        let value = JSONValue.object([
            "array": .array([.number(1), .string("two"), .bool(true), .null]),
            "nested": .object(["key": .string("value")]),
        ])

        let data = try NhostJSON.restEncoder.encode(value)
        let decoded = try NhostJSON.restDecoder.decode(JSONValue.self, from: data)

        XCTAssertEqual(decoded, value)
        XCTAssertEqual(decoded["nested"]?["key"]?.stringValue, "value")
    }
}
