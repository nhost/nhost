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

    func testDecodedBodyExtractsTypedErrorModels() {
        let body = Data(#"{"status":401,"message":"Incorrect email or password","error":"invalid-email-password"}"#.utf8)
        let fetchError = FetchError.http(
            NhostHTTPError.decode(status: 401, headers: [:], body: body)
        )

        let decoded = fetchError.decodedBody(AuthErrorResponse.self)
        XCTAssertEqual(decoded?.error, .invalidEmailPassword)
        XCTAssertEqual(decoded?.message, "Incorrect email or password")
        XCTAssertNil(FetchError.transport("offline").decodedBody(AuthErrorResponse.self))
    }

    func testAllServiceErrorsShareTheNhostServiceErrorSurface() {
        let errors: [any NhostServiceError] = [
            FetchError.http(NhostHTTPError.decode(status: 401, headers: ["x-a": "1"], body: Data())),
            GraphQLExecutionError(
                errors: [GraphQLError(message: "boom")],
                status: 200,
                headers: ["x-b": "2"],
                rawBody: Data()
            ),
            FunctionsHTTPError(
                status: 500,
                headers: ["x-c": "3"],
                body: .text("Internal Server Error"),
                rawBody: Data(),
                messages: ["Internal Server Error"]
            ),
        ]

        XCTAssertEqual(errors.map { $0.statusCode }, [401, 200, 500])
        XCTAssertEqual(
            errors.map { $0.responseHeaders },
            [["x-a": "1"], ["x-b": "2"], ["x-c": "3"]]
        )
        XCTAssertEqual(
            errors.map { $0.messages },
            [
                ["HTTP request failed with status 401"],
                ["boom"],
                ["Internal Server Error"],
            ]
        )
    }

    func testDecodingErrorsKeepCodingPathContext() async {
        let transport = StubTransport { _ in
            NhostRawResponse(
                status: 200,
                headers: ["content-type": "application/json"],
                body: Data(#"{"buildVersion":123}"#.utf8)
            )
        }
        let client = StorageClient(
            baseURL: URL(string: "https://storage.example.test/v1")!,
            transport: transport
        )

        do {
            _ = try await client.getVersion()
            XCTFail("Expected a decoding error")
        } catch let FetchError.decoding(message) {
            XCTAssertTrue(
                message.contains("buildVersion"),
                "decoding error should keep the coding path, got: \(message)"
            )
        } catch {
            XCTFail("Expected FetchError.decoding, got \(error)")
        }
    }

    func testURLSessionTransportPropagatesCancellation() async {
        let transport = URLSessionTransport()
        let request = NhostRequest(
            method: "GET",
            url: URL(string: "https://nhost-cancellation.invalid/v1")!
        )

        let task = Task {
            while !Task.isCancelled { await Task.yield() }
            _ = try await transport.fetch(request)
        }
        task.cancel()

        do {
            try await task.value
            XCTFail("Expected CancellationError")
        } catch is CancellationError {
            // expected: cancellation is not converted into FetchError.transport
        } catch {
            XCTFail("Expected CancellationError, got \(error)")
        }
    }
}
