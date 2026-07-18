import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif
import XCTest
@testable import Nhost

private actor HeaderRequestRecorder {
    private var request: NhostRequest?

    func record(_ request: NhostRequest) {
        self.request = request
    }

    func snapshot() -> NhostRequest? {
        request
    }
}

final class HTTPHeaderTests: XCTestCase {
    func testRequestInitializationReplacementAndRemovalAreCaseInsensitive() throws {
        let url = try XCTUnwrap(URL(string: "https://example.test/files"))
        var request = NhostRequest(
            method: "GET",
            url: url,
            headers: [
                "Authorization": "title-case",
                "authorization": "lowercase"
            ]
        )

        XCTAssertEqual(request.headers, ["authorization": "lowercase"])

        request.setHeader("AUTHORIZATION", "replacement")
        XCTAssertEqual(request.headers, ["authorization": "replacement"])

        request.setHeader("Authorization", nil)
        XCTAssertTrue(request.headers.isEmpty)
    }

    func testHeaderEncoderMergeOverridesAndRemovesCaseVariants() {
        let encoded = NhostHeaderEncoder.merge(
            base: [
                "Range": "bytes=0-9",
                "X-Remove": "present"
            ],
            values: [
                "rAnGe": .string("bytes=10-19"),
                "x-remove": .null
            ]
        )

        XCTAssertEqual(encoded, ["range": "bytes=10-19"])

        let overridden = NhostHeaderEncoder.merge(
            base: ["RANGE": "base"],
            overrides: [
                "Range": "title-case",
                "range": "lowercase"
            ]
        )
        XCTAssertEqual(overridden, ["range": "lowercase"])
    }

    func testTransportEmissionCollapsesCaseVariantsDeterministically() throws {
        let url = try XCTUnwrap(URL(string: "https://example.test/files"))
        var request = NhostRequest(
            method: "GET",
            url: url,
            headers: ["x-trace": "canonical"]
        )
        // Direct dictionary mutation remains source-compatible. The transport is the final
        // normalization boundary even if a caller bypasses setHeader(_:_:).
        request.headers["X-Trace"] = "variant"

        let emitted = URLSessionTransport.urlRequest(from: request)
        let matchingFields = (emitted.allHTTPHeaderFields ?? [:]).filter {
            $0.key.lowercased() == "x-trace"
        }

        XCTAssertEqual(matchingFields.count, 1)
        XCTAssertEqual(emitted.value(forHTTPHeaderField: "X-TRACE"), "canonical")
    }

    func testGeneratedExtraHeaderOverrideAndCustomTransportResponseLookup() async throws {
        let recorder = HeaderRequestRecorder()
        let transport = StubTransport { request in
            await recorder.record(request)
            return NhostRawResponse(
                status: 200,
                headers: ["ETag": "custom-etag"],
                body: Data("file".utf8)
            )
        }
        let client = StorageClient(
            baseURL: try XCTUnwrap(URL(string: "https://storage.example.test/v1")),
            transport: transport
        )

        let response = try await client.getFile(
            id: "file-id",
            headers: StorageGetFileHeaders(range: "bytes=0-9"),
            extraHeaders: ["rAnGe": "bytes=10-19"]
        )
        let recordedRequest = await recorder.snapshot()
        let request = try XCTUnwrap(recordedRequest)

        XCTAssertEqual(request.headers["range"], "bytes=10-19")
        XCTAssertEqual(request.headers.keys.filter { $0.lowercased() == "range" }.count, 1)
        XCTAssertEqual(response.header(named: "etag"), "custom-etag")
        XCTAssertEqual(response.header(named: "ETAG"), "custom-etag")
        XCTAssertNil(response.headers["etag"])
    }

    func testRawResponseHeaderLookupIsCaseInsensitiveForCustomTransports() {
        let response = NhostRawResponse(
            status: 204,
            headers: [
                "X-Request-ID": "title-case",
                "x-request-id": "lowercase"
            ]
        )

        XCTAssertEqual(response.header(named: "X-REQUEST-ID"), "lowercase")
    }

    func testPipelineRejectsProhibitedHeaderValueControlsBeforeCustomTransport() async throws {
        let url = try XCTUnwrap(URL(string: "https://example.test/files"))
        let pipeline = NhostFetchPipeline(fetch: { _ in
            XCTFail("The terminal fetch must not receive an invalid header")
            return NhostRawResponse(status: 200)
        })
        let prohibitedValues = [
            "prefix\0suffix",
            "prefix\nsuffix",
            "prefix\u{000B}suffix",
            "prefix\rsuffix",
            "prefix\u{007F}suffix"
        ]

        for value in prohibitedValues {
            do {
                _ = try await pipeline.send(
                    NhostRequest(method: "GET", url: url, headers: ["X-Probe": value])
                )
                XCTFail("Expected prohibited header control character to be rejected")
            } catch let error as NhostRequestValidationError {
                XCTAssertEqual(error, .prohibitedHeaderValue(name: "x-probe"))
            }
        }
    }

    func testPipelineAllowsHTTPHeaderTabAndRejectsMiddlewareInjection() async throws {
        let recorder = HeaderRequestRecorder()
        let acceptingPipeline = NhostFetchPipeline(
            transport: StubTransport { request in
                await recorder.record(request)
                return NhostRawResponse(status: 204)
            }
        )
        let url = try XCTUnwrap(URL(string: "https://example.test/files"))

        _ = try await acceptingPipeline.send(
            NhostRequest(method: "GET", url: url, headers: ["X-Probe": "one\ttwo"])
        )
        let recordedRequest = await recorder.snapshot()
        XCTAssertEqual(recordedRequest?.headers["x-probe"], "one\ttwo")

        let injectingMiddleware: ChainFunction = { request, next in
            var request = request
            request.setHeader("X-Probe", "safe\r\nX-Injected: true")
            return try await next(request)
        }
        let rejectingPipeline = NhostFetchPipeline(
            transport: StubTransport { _ in
                XCTFail("The transport must not receive a middleware-injected header")
                return NhostRawResponse(status: 200)
            },
            middleware: [injectingMiddleware]
        )

        do {
            _ = try await rejectingPipeline.send(NhostRequest(method: "GET", url: url))
            XCTFail("Expected middleware-injected header controls to be rejected")
        } catch let error as NhostRequestValidationError {
            XCTAssertEqual(error, .prohibitedHeaderValue(name: "x-probe"))
        }
    }

    func testGeneratedClientRejectsHeaderControlsWithRawFetchFunction() async throws {
        let client = StorageClient(
            baseURL: try XCTUnwrap(URL(string: "https://storage.example.test/v1")),
            fetch: { _ in
                XCTFail("The generated client fetch must not receive an invalid header")
                return NhostRawResponse(status: 200, body: Data("file".utf8))
            }
        )

        do {
            _ = try await client.getFile(
                id: "file-id",
                headers: StorageGetFileHeaders(range: "bytes=0-9\r\nX-Injected: true")
            )
            XCTFail("Expected generated header controls to be rejected")
        } catch let error as NhostRequestValidationError {
            XCTAssertEqual(error, .prohibitedHeaderValue(name: "range"))
        }
    }

    func testDefaultTransportPipelineRejectsHeaderControlsBeforeNetworkIO() async throws {
        let pipeline = NhostFetchPipeline()
        let url = try XCTUnwrap(URL(string: "https://example.test/files"))

        do {
            _ = try await pipeline.send(
                NhostRequest(method: "GET", url: url, headers: ["X-Probe": "bad\nvalue"])
            )
            XCTFail("Expected the default transport pipeline to reject the header")
        } catch let error as NhostRequestValidationError {
            XCTAssertEqual(error, .prohibitedHeaderValue(name: "x-probe"))
        }
    }
}
