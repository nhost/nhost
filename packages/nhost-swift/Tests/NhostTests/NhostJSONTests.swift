import Foundation
import XCTest
@testable import Nhost

private struct DatePayload: Codable, Equatable {
    let createdAt: Date
}

private struct UnsortedPayload: Codable, Equatable {
    let zeta: String
    let alpha: String
}

final class NhostJSONTests: XCTestCase {
    func testRESTDecoderAcceptsRFC3339WithFractionalSeconds() throws {
        let data = Data(#"{"createdAt":"2026-06-08T12:34:56.789Z"}"#.utf8)
        let payload = try NhostJSON.restDecoder.decode(DatePayload.self, from: data)

        XCTAssertEqual(NhostJSON.format(payload.createdAt), "2026-06-08T12:34:56.789Z")
    }

    func testRESTDecoderAcceptsRFC3339WithoutFractionalSeconds() throws {
        let data = Data(#"{"createdAt":"2026-06-08T12:34:56Z"}"#.utf8)
        let payload = try NhostJSON.restDecoder.decode(DatePayload.self, from: data)

        XCTAssertEqual(NhostJSON.format(payload.createdAt), "2026-06-08T12:34:56.000Z")
    }

    func testRESTEncoderEmitsFractionalRFC3339() throws {
        let date = try XCTUnwrap(NhostJSON.parse("2026-06-08T12:34:56.123Z"))
        let data = try NhostJSON.restEncoder.encode(DatePayload(createdAt: date))
        let json = try XCTUnwrap(String(data: data, encoding: .utf8))

        XCTAssertTrue(json.contains(#""createdAt":"2026-06-08T12:34:56.123Z""#))
    }

    func testRESTEncoderSortsKeys() throws {
        let data = try NhostJSON.restEncoder.encode(UnsortedPayload(zeta: "z", alpha: "a"))
        let json = try XCTUnwrap(String(data: data, encoding: .utf8))

        XCTAssertEqual(json, #"{"alpha":"a","zeta":"z"}"#)
    }
}
