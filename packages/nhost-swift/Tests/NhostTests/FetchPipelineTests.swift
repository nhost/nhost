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

    func testContextualExecutorCapturesExactlyOneFinalRequest() async throws {
        let middleware: ChainFunction = { request, next in
            var request = request
            request.setHeader("x-terminal", "yes")
            return try await next(request)
        }
        let pipeline = NhostFetchPipeline(
            transport: StubTransport { _ in NhostRawResponse(status: 200) },
            middleware: [middleware]
        )
        let request = NhostRequest(
            method: "POST",
            url: try XCTUnwrap(URL(string: "https://example.com/graphql")),
            body: Data("body".utf8)
        )

        let captured = try await pipeline.sendCapturingTerminalRequests(request)

        XCTAssertEqual(captured?.response.status, 200)
        XCTAssertEqual(captured?.transcript.requests.count, 1)
        XCTAssertEqual(captured?.transcript.requests.first?.headers["x-terminal"], "yes")
    }

    func testContextualExecutorRecordsZeroAndMultipleTerminalCalls() async throws {
        let url = try XCTUnwrap(URL(string: "https://example.com/graphql"))
        let request = NhostRequest(method: "POST", url: url, body: Data("body".utf8))
        let synthetic: ChainFunction = { _, _ in NhostRawResponse(status: 202) }
        let zeroPipeline = NhostFetchPipeline(
            transport: StubTransport { _ in XCTFail("transport must not run"); return NhostRawResponse(status: 500) },
            middleware: [synthetic]
        )
        let zero = try await zeroPipeline.sendCapturingTerminalRequests(request)
        XCTAssertEqual(zero?.response.status, 202)
        XCTAssertEqual(zero?.transcript.requests.count, 0)

        let twice: ChainFunction = { request, next in
            let response = try await next(request)
            var extra = request
            extra.setHeader("x-extra", "yes")
            _ = try await next(extra)
            return response
        }
        let multiplePipeline = NhostFetchPipeline(
            transport: StubTransport { _ in NhostRawResponse(status: 200) },
            middleware: [twice]
        )
        let multiple = try await multiplePipeline.sendCapturingTerminalRequests(request)
        XCTAssertEqual(multiple?.transcript.requests.count, 2)
        XCTAssertNil(multiple?.transcript.requests[0].headers["x-extra"])
        XCTAssertEqual(multiple?.transcript.requests[1].headers["x-extra"], "yes")
    }

    func testConcurrentContextualCapturesDoNotLeakAcrossInvocations() async throws {
        let middleware: ChainFunction = { request, next in
            await Task.yield()
            return try await next(request)
        }
        let pipeline = NhostFetchPipeline(
            transport: StubTransport { _ in NhostRawResponse(status: 200) },
            middleware: [middleware]
        )
        let url = try XCTUnwrap(URL(string: "https://example.com/graphql"))

        async let first = pipeline.sendCapturingTerminalRequests(
            NhostRequest(method: "POST", url: url, headers: ["x-call": "first"])
        )
        async let second = pipeline.sendCapturingTerminalRequests(
            NhostRequest(method: "POST", url: url, headers: ["x-call": "second"])
        )
        let results = try await [first, second]

        XCTAssertEqual(results[0]?.transcript.requests.map { $0.headers["x-call"] }, ["first"])
        XCTAssertEqual(results[1]?.transcript.requests.map { $0.headers["x-call"] }, ["second"])
    }

    func testOpaqueFetchPipelineHasNoContextualCapture() async throws {
        let pipeline = NhostFetchPipeline(fetch: { _ in NhostRawResponse(status: 200) })
        let request = NhostRequest(
            method: "POST",
            url: try XCTUnwrap(URL(string: "https://example.com/graphql"))
        )

        let captured = try await pipeline.sendCapturingTerminalRequests(request)

        XCTAssertNil(captured)
        let response = try await pipeline.send(request)
        XCTAssertEqual(response.status, 200)
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
