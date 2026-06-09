import Foundation
import XCTest
@testable import Nhost

private actor OrderRecorder {
    private var entries: [String] = []

    func append(_ entry: String) {
        entries.append(entry)
    }

    func values() -> [String] {
        entries
    }
}

final class FetchPipelineTests: XCTestCase {
    func testMiddlewareRunsInDeclarationOrderAroundTransport() async throws {
        let recorder = OrderRecorder()
        let transport = StubTransport { request in
            await recorder.append("transport:\(request.headers["x-first"] ?? "missing")")
            return NhostRawResponse(status: 200, headers: ["x-response": "yes"], body: Data(#"{"ok":true}"#.utf8))
        }
        let first: ChainFunction = { request, next in
            await recorder.append("first-before")
            var request = request
            request.setHeader("x-first", "1")
            let response = try await next(request)
            await recorder.append("first-after")
            return response
        }
        let second: ChainFunction = { request, next in
            await recorder.append("second-before")
            var request = request
            request.setHeader("x-second", "2")
            let response = try await next(request)
            await recorder.append("second-after")
            return response
        }

        let pipeline = NhostFetchPipeline(transport: transport, middleware: [first, second])
        let url = try XCTUnwrap(URL(string: "https://example.com/test"))
        let response = try await pipeline.send(NhostRequest(method: "GET", url: url))

        let order = await recorder.values()

        XCTAssertEqual(response.status, 200)
        XCTAssertEqual(order, ["first-before", "second-before", "transport:1", "second-after", "first-after"])
    }

    func testDecodeResponseThrowsStructuredHTTPError() throws {
        let response = NhostRawResponse(
            status: 401,
            headers: ["www-authenticate": "Bearer"],
            body: Data(#"{"error":"invalid token"}"#.utf8)
        )

        XCTAssertThrowsError(try NhostHTTP.decodeResponse(JSONValue.self, from: response)) { error in
            guard case let FetchError.http(httpError) = error else {
                return XCTFail("Expected FetchError.http")
            }

            XCTAssertEqual(httpError.status, 401)
            XCTAssertEqual(httpError.headers["www-authenticate"], "Bearer")
            XCTAssertEqual(httpError.messages, ["invalid token"])
        }
    }
}
