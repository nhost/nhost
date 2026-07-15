import Foundation
import XCTest
@testable import Nhost

final class ManagedSessionMutationMiddlewareTests: XCTestCase {
    func testSessionProducerPersistsOnceAndElevationReplacesInsideAuthenticatedLease() async throws {
        let initial = try StoredSession(try testAuthSession(exp: testNowSeconds + 600))
        let signedIn = try testAuthSession(
            exp: testNowSeconds + 700,
            refreshToken: "signed-in-refresh",
            refreshTokenId: "signed-in-id"
        )
        let elevated = try testAuthSession(
            exp: testNowSeconds + 800,
            refreshToken: "elevated-refresh",
            refreshTokenId: "elevated-id"
        )
        let backend = FaultInjectingSessionBackend(session: initial)
        let transport = ManagedRecordingTransport { request in
            let session = request.url.path.hasSuffix("/elevate/webauthn/verify") ? elevated : signedIn
            return NhostRawResponse(
                status: 200,
                headers: ["content-type": "application/json"],
                body: try NhostJSON.restEncoder.encode(AuthSessionPayload(session: session))
            )
        }
        let pipeline = makeManagedPipeline(store: SessionStore(storage: backend), transport: transport)

        _ = try await pipeline.send(managedRequest("POST", "/signin/anonymous", body: Data("{}".utf8)))
        let storedSignedInToken = try await backend.get()?.refreshToken
        XCTAssertEqual(storedSignedInToken, signedIn.refreshToken)

        _ = try await pipeline.send(managedRequest("POST", "/elevate/webauthn/verify", body: Data("{}".utf8)))
        let storedElevatedToken = try await backend.get()?.refreshToken
        XCTAssertEqual(storedElevatedToken, elevated.refreshToken)
        let requests = await transport.requests()
        XCTAssertNil(NhostHeaderLookup.value(in: requests[0].headers, named: "Authorization"))
        XCTAssertEqual(
            NhostHeaderLookup.value(in: requests[1].headers, named: "Authorization"),
            "Bearer \(signedIn.accessToken)"
        )
        let counts = await backend.counts()
        XCTAssertEqual(counts.set, 2)
    }

    func testDirectRefreshRejectsStaleAndMissingTokensWithoutNetwork() async throws {
        let current = try StoredSession(try testAuthSession(exp: testNowSeconds + 600))
        let transport = ManagedRecordingTransport { _ in
            XCTFail("transport must not run")
            return NhostRawResponse(status: 500)
        }

        for session in [current, nil] as [StoredSession?] {
            let store = SessionStore(storage: MemorySessionStorageBackend(session: session))
            let pipeline = makeManagedPipeline(store: store, transport: transport)
            let body = try NhostJSON.restEncoder.encode(AuthRefreshTokenRequest(refreshToken: "stale"))
            do {
                _ = try await pipeline.send(managedRequest("POST", "/token", body: body))
                XCTFail("Expected direct refresh rejection")
            } catch let error as ManagedSessionError {
                if session == nil {
                    XCTAssertEqual(error, .noSession(operation: "refreshToken"))
                } else {
                    XCTAssertEqual(error, .refreshTokenMismatch)
                }
            }
        }
        let requests = await transport.requests()
        XCTAssertTrue(requests.isEmpty)
    }

    func testDirectAndAutomaticRefreshRaceSendsOneOldTokenRequest() async throws {
        let now = Int(Date().timeIntervalSince1970)
        let expired = try StoredSession(try testAuthSession(exp: now - 10))
        let rotated = try testAuthSession(
            exp: now + 600,
            refreshToken: "rotated-race-token",
            refreshTokenId: "rotated-race-id"
        )
        let transport = ManagedRecordingTransport { _ in
            NhostRawResponse(
                status: 200,
                headers: ["content-type": "application/json"],
                body: try NhostJSON.restEncoder.encode(rotated)
            )
        }
        let client = createClient(
            NhostClientOptions(
                authURL: managedAuthTestBaseURL,
                sessionStorage: MemorySessionStorageBackend(session: expired),
                transport: transport
            )
        )
        let oldBody = AuthRefreshTokenRequest(refreshToken: expired.refreshToken)

        async let automaticSucceeded: Bool = {
            do {
                _ = try await client.refreshSession(marginSeconds: 60)
                return true
            } catch {
                return false
            }
        }()
        async let directSucceeded: Bool = {
            do {
                _ = try await client.auth.refreshToken(body: oldBody)
                return true
            } catch {
                return false
            }
        }()
        let outcomes = await [automaticSucceeded, directSucceeded]

        XCTAssertTrue(outcomes.contains(true))
        let requests = await transport.requests()
        XCTAssertEqual(requests.filter { $0.url.path == "/v1/token" }.count, 1)
        let storedRotatedToken = try await client.getUserSession()?.refreshToken
        XCTAssertEqual(storedRotatedToken, rotated.refreshToken)
    }

    func testSignOutReconstructsBodyAndClearsOnlyAfterRemoteSuccess() async throws {
        let combinations: [(token: String?, all: Bool?, expected: String?)] = [
            ("current-refresh", nil, "current-refresh"),
            ("stale", nil, "current-refresh"),
            (nil, nil, "current-refresh"),
            (nil, true, nil),
            ("stale", true, "current-refresh"),
        ]

        for combination in combinations {
            let session = try StoredSession(
                try testAuthSession(
                    exp: testNowSeconds + 600,
                    refreshToken: "current-refresh",
                    refreshTokenId: "current-id"
                )
            )
            let backend = MemorySessionStorageBackend(session: session)
            let transport = ManagedRecordingTransport { request in
                let body = try XCTUnwrap(request.body)
                let decoded = try NhostJSON.restDecoder.decode(AuthSignOutRequest.self, from: body)
                XCTAssertEqual(decoded.refreshToken, combination.expected)
                XCTAssertEqual(decoded.all, combination.all)
                XCTAssertEqual(
                    NhostHeaderLookup.value(in: request.headers, named: "Authorization"),
                    "Bearer \(session.accessToken)"
                )
                return NhostRawResponse(status: 200, body: Data(#"{"ok":true}"#.utf8))
            }
            let pipeline = makeManagedPipeline(store: SessionStore(storage: backend), transport: transport)
            let body = try NhostJSON.restEncoder.encode(
                AuthSignOutRequest(refreshToken: combination.token, all: combination.all)
            )

            _ = try await pipeline.send(managedRequest("POST", "/signout", body: body))
            let remaining = try await backend.get()
            XCTAssertNil(remaining)
        }

        let session = try StoredSession(try testAuthSession(exp: testNowSeconds + 600))
        let failingBackend = MemorySessionStorageBackend(session: session)
        let failingTransport = ManagedRecordingTransport { _ in NhostRawResponse(status: 500) }
        let failingPipeline = makeManagedPipeline(
            store: SessionStore(storage: failingBackend),
            transport: failingTransport
        )
        let body = try NhostJSON.restEncoder.encode(AuthSignOutRequest())
        _ = try await failingPipeline.send(managedRequest("POST", "/signout", body: body))
        let preservedToken = try await failingBackend.get()?.refreshToken
        XCTAssertEqual(preservedToken, session.refreshToken)
    }

    func testSignOutRetriesLocalClearAndReportsTypedUncertainState() async throws {
        let session = try StoredSession(try testAuthSession(exp: testNowSeconds + 600))
        let transport = ManagedRecordingTransport { _ in NhostRawResponse(status: 200) }
        let body = try NhostJSON.restEncoder.encode(AuthSignOutRequest())

        let retryBackend = FaultInjectingSessionBackend(session: session, removeFailures: 1)
        let retryPipeline = makeManagedPipeline(store: SessionStore(storage: retryBackend), transport: transport)
        _ = try await retryPipeline.send(managedRequest("POST", "/signout", body: body))
        let sessionAfterRetry = try await retryBackend.get()
        let retryCounts = await retryBackend.counts()
        XCTAssertNil(sessionAfterRetry)
        XCTAssertEqual(retryCounts.remove, 2)

        let uncertainBackend = FaultInjectingSessionBackend(session: session, removeFailures: 2)
        let uncertainPipeline = makeManagedPipeline(store: SessionStore(storage: uncertainBackend), transport: transport)
        do {
            _ = try await uncertainPipeline.send(managedRequest("POST", "/signout", body: body))
            XCTFail("Expected typed uncertain-state error")
        } catch let error as ManagedSessionError {
            XCTAssertEqual(error, .localSessionStateUncertain(operation: "signOut"))
        }
        let uncertainCounts = await uncertainBackend.counts()
        XCTAssertEqual(uncertainCounts.remove, 2)
    }

    func testSignOutWithoutSessionThrowsBeforeNetwork() async throws {
        let transport = ManagedRecordingTransport { _ in
            XCTFail("transport must not run without a session")
            return NhostRawResponse(status: 500)
        }
        let pipeline = makeManagedPipeline(
            store: SessionStore(storage: MemorySessionStorageBackend()),
            transport: transport
        )
        let body = try NhostJSON.restEncoder.encode(AuthSignOutRequest(all: true))

        do {
            _ = try await pipeline.send(managedRequest("POST", "/signout", body: body))
            XCTFail("Expected no-session error")
        } catch let error as ManagedSessionError {
            XCTAssertEqual(error, .noSession(operation: "signOut"))
        }
        let requests = await transport.requests()
        XCTAssertTrue(requests.isEmpty)
    }

    func testPasswordChangeClearsOnSuccessAndPreservesOnFailure() async throws {
        for status in [200, 400] {
            let session = try StoredSession(try testAuthSession(exp: testNowSeconds + 600))
            let backend = MemorySessionStorageBackend(session: session)
            let transport = ManagedRecordingTransport { request in
                XCTAssertEqual(
                    NhostHeaderLookup.value(in: request.headers, named: "Authorization"),
                    "Bearer \(session.accessToken)"
                )
                return NhostRawResponse(status: status)
            }
            let pipeline = makeManagedPipeline(store: SessionStore(storage: backend), transport: transport)
            _ = try await pipeline.send(managedRequest("POST", "/user/password", body: Data("{}".utf8)))
            let remaining = try await backend.get()
            if status == 200 {
                XCTAssertNil(remaining)
            } else {
                XCTAssertEqual(remaining?.refreshToken, session.refreshToken)
            }
        }

        let session = try StoredSession(try testAuthSession(exp: testNowSeconds + 600))
        let uncertainBackend = FaultInjectingSessionBackend(session: session, removeFailures: 2)
        let transport = ManagedRecordingTransport { _ in NhostRawResponse(status: 200) }
        let pipeline = makeManagedPipeline(
            store: SessionStore(storage: uncertainBackend),
            transport: transport
        )
        do {
            _ = try await pipeline.send(
                managedRequest("POST", "/user/password", body: Data("{}".utf8))
            )
            XCTFail("Expected password clear uncertainty")
        } catch let error as ManagedSessionError {
            XCTAssertEqual(
                error,
                .localSessionStateUncertain(operation: "changeUserPassword")
            )
        }
    }

    func testCancellationIgnoringTransportPersistsRemoteSessionBeforeThrowing() async throws {
        let replacement = try testAuthSession(
            exp: testNowSeconds + 600,
            refreshToken: "cancelled-rotation",
            refreshTokenId: "cancelled-rotation-id"
        )
        let backend = MemorySessionStorageBackend()
        let gate = ManagedCancellationGate()
        let transport = ManagedRecordingTransport { _ in
            await gate.wait()
            return NhostRawResponse(
                status: 200,
                body: try NhostJSON.restEncoder.encode(AuthSessionPayload(session: replacement))
            )
        }
        let pipeline = makeManagedPipeline(
            store: SessionStore(storage: backend),
            transport: transport
        )
        let task = Task {
            try await pipeline.send(
                managedRequest("POST", "/signin/anonymous", body: Data("{}".utf8))
            )
        }

        await gate.waitUntilEntered()
        task.cancel()
        await gate.release()
        do {
            _ = try await task.value
            XCTFail("Expected cancellation after persistence")
        } catch {
            XCTAssertTrue(error is CancellationError)
        }
        let storedToken = try await backend.get()?.refreshToken
        XCTAssertEqual(storedToken, replacement.refreshToken)
    }

}
