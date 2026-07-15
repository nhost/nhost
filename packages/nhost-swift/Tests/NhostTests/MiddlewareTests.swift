import Foundation
import XCTest
@testable import Nhost

private actor MiddlewareRequestRecorder {
    private var requests: [NhostRequest] = []

    func record(_ request: NhostRequest) {
        requests.append(request)
    }

    func request(at index: Int = 0) -> NhostRequest? {
        guard requests.indices.contains(index) else { return nil }
        return requests[index]
    }
}

final class MiddlewareTests: XCTestCase {
    func testAttachAccessTokenPreservesExplicitAuthorization() async throws {
        let session = try StoredSession(try testAuthSession(accessToken: testAccessToken(exp: testNowSeconds + 600)))
        let store = SessionStore(storage: MemorySessionStorageBackend(session: session))
        let recorder = MiddlewareRequestRecorder()
        let pipeline = NhostFetchPipeline(
            transport: StubTransport { request in
                await recorder.record(request)
                return NhostRawResponse(status: 204)
            },
            middleware: [attachAccessTokenMiddleware(sessionStore: store)]
        )
        let url = try XCTUnwrap(URL(string: "https://storage.example.test/v1/files"))

        _ = try await pipeline.send(NhostRequest(method: "GET", url: url))
        _ = try await pipeline.send(
            NhostRequest(method: "GET", url: url, headers: ["Authorization": "Bearer explicit"])
        )

        let attachedAuthorization = await recorder.request(at: 0)?.headers["Authorization"]
        let explicitAuthorization = await recorder.request(at: 1)?.headers["Authorization"]
        XCTAssertEqual(attachedAuthorization, "Bearer \(session.accessToken)")
        XCTAssertEqual(explicitAuthorization, "Bearer explicit")
    }

    func testAdminRoleAndDefaultHeadersPreserveRequestHeaders() async throws {
        let recorder = MiddlewareRequestRecorder()
        let pipeline = NhostFetchPipeline(
            transport: StubTransport { request in
                await recorder.record(request)
                return NhostRawResponse(status: 204)
            },
            middleware: [
                headersMiddleware(["x-default": "default", "x-keep": "default"]),
                roleMiddleware("moderator"),
                adminSessionMiddleware(
                    AdminSessionOptions(
                        adminSecret: "secret",
                        role: "admin",
                        sessionVariables: ["user-id": "user-1", "x-hasura-org-id": "org-1"]
                    )
                )
            ]
        )

        _ = try await pipeline.send(
            NhostRequest(
                method: "GET",
                url: try XCTUnwrap(URL(string: "https://storage.example.test/v1/files")),
                headers: ["x-keep": "request", "x-hasura-role": "request-role"]
            )
        )

        let recordedRequest = await recorder.request()
        let request = try XCTUnwrap(recordedRequest)
        XCTAssertEqual(request.headers["x-default"], "default")
        XCTAssertEqual(request.headers["x-keep"], "request")
        XCTAssertEqual(request.headers["x-hasura-role"], "request-role")
        XCTAssertEqual(request.headers["x-hasura-admin-secret"], "secret")
        XCTAssertEqual(request.headers["x-hasura-user-id"], "user-1")
        XCTAssertEqual(request.headers["x-hasura-org-id"], "org-1")
    }

    func testInternalSessionRefreshHelperSkipsExplicitAuthorization() async throws {
        let expiredSession = try StoredSession(try testAuthSession(exp: testNowSeconds - 10))
        let store = SessionStore(storage: MemorySessionStorageBackend(session: expiredSession))
        let refreshRecorder = MiddlewareRequestRecorder()
        let refreshAuth = AuthClient(
            baseURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
            transport: StubTransport { request in
                await refreshRecorder.record(request)
                return NhostRawResponse(
                    status: 200,
                    headers: ["content-type": "application/json"],
                    body: try NhostJSON.restEncoder.encode(try testAuthSession(exp: testNowSeconds + 600))
                )
            }
        )
        let refresher = SessionRefresher(auth: refreshAuth, store: store) {
            Date(timeIntervalSince1970: TimeInterval(testNowSeconds))
        }
        let pipeline = NhostFetchPipeline(
            transport: StubTransport { _ in NhostRawResponse(status: 204) },
            middleware: [sessionRefreshMiddleware(refresher: refresher, marginSeconds: 60)]
        )

        _ = try await pipeline.send(
            NhostRequest(
                method: "GET",
                url: try XCTUnwrap(URL(string: "https://storage.example.test/v1/files")),
                headers: ["Authorization": "Bearer explicit"]
            )
        )
        let skippedRefreshRequest = await refreshRecorder.request()
        XCTAssertNil(skippedRefreshRequest)

        _ = try await pipeline.send(
            NhostRequest(method: "GET", url: try XCTUnwrap(URL(string: "https://storage.example.test/v1/files")))
        )
        let refreshRequestPath = await refreshRecorder.request()?.url.path
        XCTAssertEqual(refreshRequestPath, "/v1/token")
    }
}
