import Foundation
import XCTest
@testable import Nhost

private struct ReferenceRequestBody: Codable, Equatable, Sendable {
    let email: String
    let verificationCode: String
}

private struct ReferenceResponseBody: Codable, Equatable, Sendable {
    let id: String
}

private actor RequestRecorder {
    private var requests: [NhostRequest] = []

    func record(_ request: NhostRequest) {
        requests.append(request)
    }

    func firstRequest() -> NhostRequest? {
        requests.first
    }
}

private struct ReferenceAuthClient: Sendable {
    let baseURL: URL
    let fetch: FetchFunction

    func signIn(
        body: ReferenceRequestBody,
        redirectTo: URL?,
        role: String?
    ) async throws -> NhostResponse<ReferenceResponseBody> {
        let url = NhostURLBuilder.url(
            baseURL: baseURL,
            path: "/signin/email-password",
            query: ["redirectTo": redirectTo.map { .string($0.absoluteString) }]
        )
        let headers = NhostHeaderEncoder.merge(
            base: [
                "accept": "application/json",
                "content-type": "application/json",
            ],
            values: ["x-hasura-role": role.map { .string($0) }]
        )
        let request = try NhostRequest(
            method: "POST",
            url: url,
            headers: headers,
            body: NhostJSON.restEncoder.encode(body)
        )
        let response = try await fetch(request)

        return try NhostHTTP.decodeResponse(ReferenceResponseBody.self, from: response)
    }
}

final class ReferenceClientTests: XCTestCase {
    func testReferenceClientUsesGeneratedCodeRuntimeShape() async throws {
        let recorder = RequestRecorder()
        let transport = StubTransport { request in
            await recorder.record(request)
            return NhostRawResponse(
                status: 200,
                headers: ["content-type": "application/json"],
                body: Data(#"{"id":"user-1"}"#.utf8)
            )
        }
        let pipeline = NhostFetchPipeline(transport: transport)
        let client = ReferenceAuthClient(
            baseURL: try XCTUnwrap(URL(string: "https://auth.example.com/v1")),
            fetch: pipeline.fetch
        )

        let response = try await client.signIn(
            body: ReferenceRequestBody(email: "me@example.com", verificationCode: "test-value"),
            redirectTo: try XCTUnwrap(URL(string: "https://app.example.com/callback")),
            role: "user"
        )

        let recordedRequest = await recorder.firstRequest()
        let request = try XCTUnwrap(recordedRequest)
        let requestBody = try XCTUnwrap(request.body)
        let decodedRequestBody = try NhostJSON.restDecoder.decode(ReferenceRequestBody.self, from: requestBody)

        XCTAssertEqual(response.body, ReferenceResponseBody(id: "user-1"))
        XCTAssertEqual(response.status, 200)
        XCTAssertEqual(request.method, "POST")
        XCTAssertEqual(
            request.url.absoluteString,
            "https://auth.example.com/v1/signin/email-password?redirectTo=https%3A%2F%2Fapp.example.com%2Fcallback"
        )
        XCTAssertEqual(request.headers["accept"], "application/json")
        XCTAssertEqual(request.headers["content-type"], "application/json")
        XCTAssertEqual(request.headers["x-hasura-role"], "user")
        XCTAssertEqual(decodedRequestBody, ReferenceRequestBody(email: "me@example.com", verificationCode: "test-value"))
    }
}
