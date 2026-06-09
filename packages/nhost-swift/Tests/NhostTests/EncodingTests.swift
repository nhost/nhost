import Foundation
import XCTest
@testable import Nhost

final class EncodingTests: XCTestCase {
    func testQueryEncoderRepeatsArraysAndFlattensObjects() throws {
        let url = try XCTUnwrap(URL(string: "https://example.com/v1/files?existing=true"))
        let encoded = NhostQueryEncoder.append(
            [
                "filter": .object(["owner-id": .string("user 1")]),
                "ids": .array([.number(2), .number(1)]),
                "skip": .null,
            ],
            to: url
        )

        let components = try XCTUnwrap(URLComponents(url: encoded, resolvingAgainstBaseURL: false))
        XCTAssertEqual(
            components.queryItems,
            [
                URLQueryItem(name: "existing", value: "true"),
                URLQueryItem(name: "filter[owner-id]", value: "user 1"),
                URLQueryItem(name: "ids", value: "2"),
                URLQueryItem(name: "ids", value: "1"),
            ]
        )
    }

    func testHeaderEncoderSkipsNullAndJoinsArrays() {
        let headers = NhostHeaderEncoder.merge(
            base: ["accept": "application/json", "x-remove": "yes"],
            values: [
                "x-array": .array([.string("a"), .number(2)]),
                "x-bool": .bool(true),
                "x-remove": .null,
            ]
        )

        XCTAssertEqual(headers["accept"], "application/json")
        XCTAssertEqual(headers["x-array"], "a,2")
        XCTAssertEqual(headers["x-bool"], "true")
        XCTAssertNil(headers["x-remove"])
    }

    func testURLEncodedFormEncoder() throws {
        let body = NhostURLEncodedFormEncoder.encode([
            "email": .string("me@example.com"),
            "options": .object(["redirectTo": .string("https://app.example.com/callback")]),
        ])
        let encoded = try XCTUnwrap(String(data: body, encoding: .utf8))

        XCTAssertEqual(
            encoded,
            "email=me%40example.com&options%5BredirectTo%5D=https%3A%2F%2Fapp.example.com%2Fcallback"
        )
    }

    func testMultipartEncoder() throws {
        let multipart = NhostMultipartEncoder.encode(
            parts: [
                .formField(name: "metadata[]", value: .string("avatar")),
                .file(
                    name: "file[]",
                    filename: "avatar.png",
                    contentType: "image/png",
                    data: Data([0x01, 0x02])
                ),
            ],
            boundary: "boundary"
        )

        let body = try XCTUnwrap(String(data: multipart.body, encoding: .utf8))
        XCTAssertEqual(multipart.contentType, "multipart/form-data; boundary=boundary")
        XCTAssertTrue(body.contains(#"name="metadata[]""#))
        XCTAssertTrue(body.contains(#"name="file[]"; filename="avatar.png""#))
        XCTAssertTrue(body.contains("Content-Type: image/png"))
        XCTAssertTrue(body.hasSuffix("--boundary--\r\n"))
    }

    func testURLBuilderAndBinaryBody() throws {
        let baseURL = try XCTUnwrap(URL(string: "https://example.com/api/"))
        let segment = NhostURLBuilder.percentEncodePathSegment("avatar image.png")
        let url = NhostURLBuilder.redirectURL(
            baseURL: baseURL,
            path: "/files/\(segment)",
            query: ["download": .bool(true)]
        )

        XCTAssertEqual(url.absoluteString, "https://example.com/api/files/avatar%20image.png?download=true")
        XCTAssertEqual(NhostBinaryBody.encode(Data([0x01])), Data([0x01]))
    }
}
