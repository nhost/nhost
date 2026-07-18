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

    func testQueryAndHeaderEncodersUseFixedWidthIntegerFormatting() throws {
        let values: [(value: JSONValue, expected: String)] = [
            (.integer(.min), "-9223372036854775808"),
            (.number(2_147_483_648), "2147483648"),
            (.number(1_770_000_000_123), "1770000000123"),
            (.number(Double(Int64.max).nextDown), "9223372036854774784"),
            (.integer(.max), "9223372036854775807"),
        ]

        for (value, expected) in values {
            XCTAssertEqual(NhostQueryEncoder.string(from: value), expected)
            XCTAssertEqual(
                NhostHeaderEncoder.merge(values: ["x-value": value])["x-value"],
                expected
            )
        }

        let url = try XCTUnwrap(URL(string: "https://example.com/v1/files"))
        let encoded = NhostQueryEncoder.append(["value": .integer(.max)], to: url)
        let components = try XCTUnwrap(URLComponents(url: encoded, resolvingAgainstBaseURL: false))
        XCTAssertEqual(
            components.queryItems,
            [URLQueryItem(name: "value", value: "9223372036854775807")]
        )
    }

    func testExplicitFloatingPointValueOutsideInt64UsesDoubleDescription() throws {
        let value = 9_223_372_036_854_775_808.0
        let url = try XCTUnwrap(URL(string: "https://example.com/v1/files"))
        let encoded = NhostQueryEncoder.append(["value": .number(value)], to: url)
        let components = try XCTUnwrap(URLComponents(url: encoded, resolvingAgainstBaseURL: false))
        let headers = NhostHeaderEncoder.merge(values: ["x-value": .number(value)])

        XCTAssertEqual(
            components.queryItems,
            [URLQueryItem(name: "value", value: String(value))]
        )
        XCTAssertEqual(headers["x-value"], String(value))
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
        let multipart = try NhostMultipartEncoder.encode(
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

    func testMultipartEncoderPropagatesFileReadErrors() {
        let missingURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("nhost-missing-\(UUID().uuidString).bin")

        XCTAssertThrowsError(
            try NhostMultipartEncoder.encode(
                parts: [
                    .file(
                        name: "file[]",
                        filename: "missing.bin",
                        contentType: "application/octet-stream",
                        fileURL: missingURL
                    ),
                ],
                boundary: "boundary"
            )
        )
    }

    func testQueryEncoderEncodesPlusSignAndPreservesEncodedBaseItems() throws {
        let url = try XCTUnwrap(URL(string: "https://example.com/v1/signin?next=a%2Bb"))
        let encoded = NhostQueryEncoder.append(
            ["email": .string("me+alias@example.com")],
            to: url
        )

        let components = try XCTUnwrap(URLComponents(url: encoded, resolvingAgainstBaseURL: false))
        XCTAssertEqual(components.percentEncodedQuery, "next=a%2Bb&email=me%2Balias%40example.com")
    }

    func testMultipartEncoderStripsHeaderInjectionAttempts() throws {
        let multipart = try NhostMultipartEncoder.encode(
            parts: [
                .file(
                    name: "file\r\nX-Injected: name",
                    filename: "evil\"\r\nContent-Type: text/html\r\n\r\n<script>",
                    contentType: "image/png\r\nX-Injected: content-type",
                    data: Data([0x01])
                ),
            ],
            boundary: "boundary"
        )

        let body = try XCTUnwrap(String(data: multipart.body, encoding: .utf8))
        // CR/LF is stripped, so injected text can never start a new header line or
        // terminate the part headers early.
        XCTAssertFalse(body.contains("\r\nX-Injected"))
        XCTAssertFalse(body.contains("\r\n\r\n<script>"))
        XCTAssertTrue(body.contains(#"name="fileX-Injected: name""#))
        XCTAssertTrue(body.contains(#"filename="evil\"Content-Type: text/html<script>""#))
        XCTAssertTrue(body.contains("Content-Type: image/pngX-Injected: content-type\r\n"))
    }

    func testURLBuilderDoesNotTrapOnUnencodedPathsAndQueries() throws {
        let baseURL = try XCTUnwrap(URL(string: "https://example.com/v1"))

        let spacedPath = NhostURLBuilder.url(baseURL: baseURL, path: "/hello world/100%")
        XCTAssertEqual(spacedPath.absoluteString, "https://example.com/v1/hello%20world/100%25")

        let alreadyEncoded = NhostURLBuilder.url(baseURL: baseURL, path: "/files/avatar%20image.png")
        XCTAssertEqual(
            alreadyEncoded.absoluteString,
            "https://example.com/v1/files/avatar%20image.png"
        )

        XCTAssertEqual(NhostURLBuilder.validPercentEncodedQuery("q=a%2Bb&x=1"), "q=a%2Bb&x=1")
        XCTAssertEqual(NhostURLBuilder.validPercentEncodedQuery("q=a b"), "q=a%20b")
        XCTAssertEqual(NhostURLBuilder.validPercentEncodedQuery("bad=%2"), "bad=%252")
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
