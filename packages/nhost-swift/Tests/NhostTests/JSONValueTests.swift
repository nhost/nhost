import Foundation
import XCTest
@testable import Nhost

final class JSONValueTests: XCTestCase {
    func testRoundTrip() throws {
        let value = JSONValue.object([
            "array": .array([.integer(1), .string("two"), .bool(true), .null]),
            "nested": .object(["key": .string("value")]),
        ])

        let data = try NhostJSON.restEncoder.encode(value)
        let decoded = try NhostJSON.restDecoder.decode(JSONValue.self, from: data)

        XCTAssertEqual(decoded, value)
        XCTAssertEqual(decoded["nested"]?["key"]?.stringValue, "value")
    }

    func testIntegralTokensRoundTripExactlyAcrossInt64Boundaries() throws {
        let values: [(token: String, value: Int64)] = [
            ("-9223372036854775808", .min),
            ("9007199254740993", 9_007_199_254_740_993),
            ("9223372036854775807", .max),
        ]

        for (token, value) in values {
            let decoded = try NhostJSON.neutralDecoder.decode(
                JSONValue.self,
                from: Data(token.utf8)
            )
            XCTAssertEqual(decoded, .integer(value), token)

            let encoded = try NhostJSON.neutralEncoder.encode(decoded)
            XCTAssertEqual(String(data: encoded, encoding: .utf8), token)
        }
    }

    func testIntegralTokensOutsideInt64AreRejectedInsteadOfRounded() {
        for token in [
            "-9223372036854775809",
            "9223372036854775808",
            "18446744073709551615",
            "1e20",
        ] {
            XCTAssertThrowsError(
                try NhostJSON.neutralDecoder.decode(JSONValue.self, from: Data(token.utf8)),
                token
            ) { error in
                guard case let DecodingError.dataCorrupted(context) = error else {
                    return XCTFail("expected dataCorrupted for \(token), got \(error)")
                }
                XCTAssertTrue(context.debugDescription.contains("signed 64-bit range"))
            }
        }
    }

    func testWireEncoderPreservesLargeFixedWidthInteger() throws {
        let value: Int64 = 9_007_199_254_740_993

        XCTAssertEqual(try NhostWireEncoder.jsonValue(value), .integer(value))
        XCTAssertThrowsError(try NhostWireEncoder.jsonValue(UInt64.max))
    }

    func testFractionalTokenRemainsFloatingPoint() throws {
        let decoded = try NhostJSON.neutralDecoder.decode(
            JSONValue.self,
            from: Data("1.5".utf8)
        )

        XCTAssertEqual(decoded, .number(1.5))
    }
}
