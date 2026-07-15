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

private actor AuthorizationHeaderRecorder {
    private(set) var values: [String?] = []

    func record(_ value: String?) {
        values.append(value)
    }
}

private actor ClientCoordinationRecorder {
    private var acquisitions = 0

    func recordAcquisition() {
        acquisitions += 1
    }

    func count() -> Int {
        acquisitions
    }
}

private struct ClientRecordingCoordinator: SessionCoordinator {
    let recorder: ClientCoordinationRecorder

    func withCoordination<Result: Sendable>(
        _ operation: @Sendable () async throws -> Result
    ) async throws -> Result {
        await recorder.recordAcquisition()
        return try await operation()
    }
}

final class NhostClientTests: XCTestCase {
    func testGenerateServiceUrlMatrix() throws {
        XCTAssertEqual(
            generateServiceURL(.auth).absoluteString,
            "https://local.auth.local.nhost.run/v1"
        )
        XCTAssertEqual(
            generateServiceURL(.storage, subdomain: "proj", region: "eu-central-1").absoluteString,
            "https://proj.storage.eu-central-1.nhost.run/v1"
        )

        let custom = try XCTUnwrap(URL(string: "https://auth.example.test/custom"))
        XCTAssertEqual(
            generateServiceURL(.auth, subdomain: "ignored", region: "ignored", customURL: custom),
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
                sessionManagement: .processLocal(storage: MemorySessionStorageBackend()),
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

    func testCustomMiddlewareRunsInsideSessionMiddleware() async throws {
        // nhost-js parity: user middleware is innermost, so it observes the Bearer
        // token attached by the session middleware instead of running before it.
        let session = try testAuthSession(exp: Int(Date().timeIntervalSince1970) + 600)
        let transport = ClientRecordingTransport(session: session)
        let recorder = AuthorizationHeaderRecorder()

        let observer: ChainFunction = { request, next in
            await recorder.record(NhostHeaderLookup.value(in: request.headers, named: "authorization"))
            return try await next(request)
        }

        let client = createClient(
            NhostClientOptions(
                authURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
                storageURL: try XCTUnwrap(URL(string: "https://storage.example.test/v1")),
                sessionManagement: .processLocal(
                    storage: MemorySessionStorageBackend(session: try StoredSession(session))
                ),
                transport: transport,
                middleware: [observer]
            )
        )

        _ = try await client.storage.getFile(id: "file-1")

        let observedAuthorization = await recorder.values
        XCTAssertEqual(observedAuthorization, ["Bearer \(session.accessToken)"])
    }

    func testDedicatedAutomaticRefreshClientHasNoSessionMiddleware() async throws {
        let current = try testAuthSession(exp: Int(Date().timeIntervalSince1970) + 600)
        let transport = ClientRecordingTransport(session: current)
        let client = createClient(
            NhostClientOptions(
                authURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
                sessionManagement: .processLocal(
                    storage: MemorySessionStorageBackend(session: try StoredSession(current))
                ),
                transport: transport
            )
        )

        _ = try await client.refreshSession(marginSeconds: 0)

        let tokenRequests = await transport.requestsMatching(pathSuffix: "/token")
        XCTAssertEqual(tokenRequests.count, 1)
        XCTAssertNil(tokenRequests.first?.headers["Authorization"])
    }

    func testCreateNhostClientAppliesAdminSessionToNonAuthServices() async throws {
        let session = try testAuthSession(exp: testNowSeconds + 600)
        let transport = ClientRecordingTransport(session: session)
        let client = createNhostClient(
            NhostClientOptions(
                authURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
                storageURL: try XCTUnwrap(URL(string: "https://storage.example.test/v1")),
                sessionManagement: .processLocal(storage: MemorySessionStorageBackend()),
                transport: transport,
                adminSession: AdminSessionOptions(
                    adminSecret: "secret",
                    role: "admin",
                    sessionVariables: ["user-id": "user-1"]
                )
            )
        )

        _ = try await client.auth.getJWKs()
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

    func testCreateNhostClientCarriesExplicitStoreWithoutManagedMiddleware() async throws {
        let session = try testAuthSession(exp: testNowSeconds + 600)
        let backend = MemorySessionStorageBackend()
        let recorder = ClientCoordinationRecorder()
        let client = createNhostClient(
            NhostClientOptions(
                authURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
                sessionManagement: SessionManagementConfiguration(
                    storage: backend,
                    coordinator: ClientRecordingCoordinator(recorder: recorder),
                    acquisitionPolicy: .automaticRefresh
                ),
                transport: ClientRecordingTransport(session: session)
            )
        )

        _ = try await client.auth.signInEmailPassword(
            body: AuthSignInEmailPasswordRequest(email: "me@example.test", password: "credential")
        )
        let afterSignIn = try await backend.get()
        XCTAssertNil(afterSignIn)

        _ = try await client.sessionStore.set(session)
        let explicitStored = try await backend.get()
        let acquisitionCount = await recorder.count()
        XCTAssertEqual(explicitStored?.accessToken, session.accessToken)
        XCTAssertEqual(acquisitionCount, 1)
    }

    func testCreateClientAutomaticallyRefreshesConfiguredExpiredSession() async throws {
        let expired = try StoredSession(try testAuthSession(exp: testNowSeconds - 10))
        let rotated = try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "rotated-client-token",
            refreshTokenId: "rotated-client-id"
        )
        let transport = ClientRecordingTransport(session: rotated)
        let client = createClient(
            NhostClientOptions(
                authURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
                storageURL: try XCTUnwrap(URL(string: "https://storage.example.test/v1")),
                sessionManagement: .processLocal(
                    storage: MemorySessionStorageBackend(session: expired)
                ),
                transport: transport,
                sessionRefreshMarginSeconds: 60
            )
        )

        _ = try await client.storage.getFile(id: "file-1")

        let tokenRequests = await transport.requestsMatching(pathSuffix: "/token")
        let stored = try await client.getUserSession()
        XCTAssertEqual(tokenRequests.count, 1)
        XCTAssertEqual(stored?.refreshToken, rotated.refreshToken)
    }

    func testCreateServerClientCoordinatesPersistenceAndClearWithoutAutoRefresh() async throws {
        let session = try testAuthSession(exp: testNowSeconds + 600)
        let backend = MemorySessionStorageBackend()
        let recorder = ClientCoordinationRecorder()
        let transport = ClientRecordingTransport(session: session)
        let client = createServerClient(
            NhostServerClientOptions(
                authURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
                sessionManagement: .server(
                    storage: backend,
                    coordinator: ClientRecordingCoordinator(recorder: recorder)
                ),
                transport: transport
            )
        )

        _ = try await client.auth.signInEmailPassword(
            body: AuthSignInEmailPasswordRequest(email: "me@example.test", password: "credential")
        )
        let persisted = try await backend.get()
        XCTAssertEqual(persisted?.accessToken, session.accessToken)

        try await client.clearSession()
        let cleared = try await backend.get()
        let acquisitionCount = await recorder.count()
        let tokenRequests = await transport.requestsMatching(pathSuffix: "/token")
        XCTAssertNil(cleared)
        XCTAssertEqual(acquisitionCount, 2)
        XCTAssertTrue(tokenRequests.isEmpty)
    }

    func testSessionManagementConfigurationDefaultsAndConveniences() {
        let defaultConfiguration = SessionManagementConfiguration()
        XCTAssertEqual(defaultConfiguration.acquisitionPolicy, .automaticRefresh)
        XCTAssertTrue(defaultConfiguration.coordinator is ProcessLocalSessionCoordinator)
        #if canImport(Security)
        XCTAssertTrue(defaultConfiguration.storage is KeychainSessionStorageBackend)
        #else
        XCTAssertTrue(defaultConfiguration.storage is MemorySessionStorageBackend)
        #endif

        let processLocal = SessionManagementConfiguration.processLocal(
            storage: MemorySessionStorageBackend(),
            acquisitionPolicy: .automaticRefresh
        )
        XCTAssertEqual(processLocal.acquisitionPolicy, .automaticRefresh)
        XCTAssertTrue(processLocal.coordinator is ProcessLocalSessionCoordinator)

        let server = SessionManagementConfiguration.server(storage: MemorySessionStorageBackend())
        XCTAssertEqual(server.acquisitionPolicy, .noAutomaticRefresh)
        XCTAssertTrue(server.coordinator is ProcessLocalSessionCoordinator)
    }

    func testCreateServerClientUsesCustomStorageWithoutAutoRefresh() async throws {
        let expiredSession = try StoredSession(try testAuthSession(exp: testNowSeconds - 10))
        let transport = ClientRecordingTransport(session: try testAuthSession(exp: testNowSeconds + 600))
        let client = createServerClient(
            NhostServerClientOptions(
                authURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1")),
                storageURL: try XCTUnwrap(URL(string: "https://storage.example.test/v1")),
                sessionManagement: .server(
                    storage: MemorySessionStorageBackend(session: expiredSession)
                ),
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

extension NhostClientTests {
    func testClientFactoriesPercentEncodeCallerSuppliedServiceURLHostComponents() {
        let subdomain = "my app%"
        let region = "eu/central"
        let expectedAuthURL = "https://my%20app%25.auth.eu%2Fcentral.nhost.run/v1"

        XCTAssertEqual(
            generateServiceURL(.auth, subdomain: subdomain, region: region).absoluteString,
            expectedAuthURL
        )

        let options = NhostClientOptions(subdomain: subdomain, region: region)
        XCTAssertEqual(createNhostClient(options).serviceURLs.auth.absoluteString, expectedAuthURL)
        XCTAssertEqual(createClient(options).serviceURLs.auth.absoluteString, expectedAuthURL)

        let server = createServerClient(
            NhostServerClientOptions(
                subdomain: subdomain,
                region: region,
                sessionManagement: .server(storage: MemorySessionStorageBackend())
            )
        )
        XCTAssertEqual(server.serviceURLs.auth.absoluteString, expectedAuthURL)
    }
}
