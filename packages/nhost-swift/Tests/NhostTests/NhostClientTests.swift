import Foundation
import XCTest
@testable import Nhost

private actor ClientRecordingTransport: HTTPTransport {
    private let session: AuthSession
    private var requests: [NhostRequest] = []

    init(session: AuthSession) {
        self.session = session
    }

    func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        requests.append(request)

        if request.url.path.hasSuffix("/signin/email-password") {
            return NhostRawResponse(
                status: 200,
                headers: ["content-type": "application/json"],
                body: try NhostJSON.restEncoder.encode(AuthSignInEmailPasswordResponse(session: session))
            )
        }

        if request.url.path.hasSuffix("/.well-known/jwks.json") {
            return NhostRawResponse(
                status: 200,
                headers: ["content-type": "application/json"],
                body: Data(#"{"keys":[]}"#.utf8)
            )
        }

        if request.url.path.hasSuffix("/token") {
            return NhostRawResponse(
                status: 200,
                headers: ["content-type": "application/json"],
                body: try NhostJSON.restEncoder.encode(session)
            )
        }

        return NhostRawResponse(status: 200, headers: ["content-type": "application/octet-stream"], body: Data("file".utf8))
    }

    func request(at index: Int = 0) -> NhostRequest? {
        guard requests.indices.contains(index) else { return nil }
        return requests[index]
    }

    func requestsMatching(pathSuffix: String) -> [NhostRequest] {
        requests.filter { $0.url.path.hasSuffix(pathSuffix) }
    }
}

final class NhostClientTests: XCTestCase {
    func testGenerateServiceUrlMatrix() throws {
        XCTAssertEqual(
            generateServiceUrl(.auth).absoluteString,
            "https://local.auth.local.nhost.run/v1"
        )
        XCTAssertEqual(
            generateServiceUrl(.storage, subdomain: "proj", region: "eu-central-1").absoluteString,
            "https://proj.storage.eu-central-1.nhost.run/v1"
        )

        let custom = try XCTUnwrap(URL(string: "https://auth.example.test/custom"))
        XCTAssertEqual(
            generateServiceUrl(.auth, subdomain: "ignored", region: "ignored", customURL: custom),
            custom
        )
    }

    func testCreateClientConfiguresSessionMiddlewareAndServiceClients() async throws {
        let authURL = try XCTUnwrap(URL(string: "https://auth.example.test/v1"))
        let storageURL = try XCTUnwrap(URL(string: "https://storage.example.test/v1"))
        let session = try testAuthSession(exp: Int(Date().timeIntervalSince1970) + 600)
        let transport = ClientRecordingTransport(session: session)
        let client = createClient(
            NhostClientOptions(
                authURL: authURL,
                storageURL: storageURL,
                storage: MemorySessionStorageBackend(),
                transport: transport,
                defaultHeaders: ["x-sdk": "swift"],
                role: "user"
            )
        )

        let credential = ["test", "credential"].joined(separator: "-")
        let signIn = try await client.auth.signInEmailPassword(
            body: AuthSignInEmailPasswordRequest(email: "me@example.test", password: credential)
        )
        _ = try await client.storage.getFile(id: "file-1")

        let recordedAuthRequest = await transport.request(at: 0)
        let recordedStorageRequest = await transport.request(at: 1)
        let storedAccessToken = try await client.getUserSession()?.accessToken
        let authRequest = try XCTUnwrap(recordedAuthRequest)
        let storageRequest = try XCTUnwrap(recordedStorageRequest)

        XCTAssertEqual(client.serviceURLs.auth, authURL)
        XCTAssertEqual(client.serviceURLs.storage, storageURL)
        XCTAssertEqual(signIn.body.session?.accessToken, session.accessToken)
        XCTAssertEqual(storedAccessToken, session.accessToken)
        XCTAssertEqual(authRequest.headers["x-sdk"], "swift")
        XCTAssertEqual(authRequest.headers["x-hasura-role"], "user")
        XCTAssertNil(authRequest.headers["Authorization"])
        XCTAssertEqual(storageRequest.headers["Authorization"], "Bearer \(session.accessToken)")
        XCTAssertEqual(storageRequest.headers["x-sdk"], "swift")
        XCTAssertEqual(storageRequest.headers["x-hasura-role"], "user")
    }

    func testCreateNhostClientAppliesAdminSessionToStorageOnly() async throws {
        let session = try testAuthSession(exp: testNowSeconds + 600)
        let transport = ClientRecordingTransport(session: session)
        let client = createNhostClient(
            NhostClientOptions(
                authURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
                storageURL: try XCTUnwrap(URL(string: "https://storage.example.test/v1")),
                storage: MemorySessionStorageBackend(),
                transport: transport,
                adminSession: AdminSessionOptions(
                    adminSecret: "secret",
                    role: "admin",
                    sessionVariables: ["user-id": "user-1"]
                )
            )
        )

        _ = try await client.auth.getJwKs()
        _ = try await client.storage.getFile(id: "file-1")

        let recordedAuthRequest = await transport.request(at: 0)
        let recordedStorageRequest = await transport.request(at: 1)
        let authRequest = try XCTUnwrap(recordedAuthRequest)
        let storageRequest = try XCTUnwrap(recordedStorageRequest)

        XCTAssertNil(authRequest.headers["x-hasura-admin-secret"])
        XCTAssertEqual(storageRequest.headers["x-hasura-admin-secret"], "secret")
        XCTAssertEqual(storageRequest.headers["x-hasura-role"], "admin")
        XCTAssertEqual(storageRequest.headers["x-hasura-user-id"], "user-1")
        XCTAssertNil(storageRequest.headers["Authorization"])
    }

    func testCreateServerClientUsesCustomStorageWithoutAutoRefresh() async throws {
        let expiredSession = try StoredSession(try testAuthSession(exp: testNowSeconds - 10))
        let transport = ClientRecordingTransport(session: try testAuthSession(exp: testNowSeconds + 600))
        let client = createServerClient(
            NhostServerClientOptions(
                authURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
                storageURL: try XCTUnwrap(URL(string: "https://storage.example.test/v1")),
                storage: MemorySessionStorageBackend(session: expiredSession),
                transport: transport
            )
        )

        _ = try await client.storage.getFile(id: "file-1")

        let recordedStorageRequest = await transport.request()
        let tokenRequests = await transport.requestsMatching(pathSuffix: "/token")
        let storageRequest = try XCTUnwrap(recordedStorageRequest)
        XCTAssertEqual(storageRequest.headers["Authorization"], "Bearer \(expiredSession.accessToken)")
        XCTAssertTrue(tokenRequests.isEmpty)
    }
}
