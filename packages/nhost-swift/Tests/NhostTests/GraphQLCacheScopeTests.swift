import Foundation
import XCTest
@testable import Nhost

final class GraphQLCacheScopeTests: XCTestCase {
    fileprivate let endpoint = URL(string: "https://graphql.example.test/v1")!
    fileprivate let graphQLRequest = GraphQLRequest(query: "query Viewer { viewer { id } }")
}

extension GraphQLCacheScopeTests {
    func testProtectedContextsProduceDistinctScopeDigests() async throws {
        let anonymous = try await snapshot(session: nil)
        let userOne = try await snapshot(session: try session(subject: "user-1"))
        let userTwo = try await snapshot(session: try session(subject: "user-2"))
        let changedClaims = try await snapshot(
            session: try session(
                subject: "user-1",
                hasuraClaims: [
                    "x-hasura-default-role": "user",
                    "x-hasura-allowed-roles": "{user}",
                    "x-hasura-org-id": "org-2"
                ]
            )
        )

        let scopes = try await [
            scope(snapshot: anonymous, usesManagedSession: false),
            scope(snapshot: userOne),
            scope(snapshot: userTwo),
            scope(snapshot: changedClaims),
            scope(snapshot: userOne, headers: ["x-hasura-role": "editor"]),
            scope(snapshot: userOne, headers: ["x-hasura-org-id": "org-1"]),
            scope(snapshot: userOne, defaults: ["x-client-variant": "ios"]),
            scope(snapshot: anonymous, usesManagedSession: false, headers: ["Authorization": "Bearer explicit-a"]),
            scope(snapshot: anonymous, usesManagedSession: false, headers: ["Authorization": "Bearer explicit-b"]),
            scope(
                snapshot: anonymous,
                usesManagedSession: false,
                admin: AdminSessionOptions(adminSecret: "admin-a", role: "admin")
            ),
            scope(
                snapshot: anonymous,
                usesManagedSession: false,
                admin: AdminSessionOptions(adminSecret: "admin-b", role: "admin")
            ),
            scope(
                snapshot: anonymous,
                usesManagedSession: false,
                admin: AdminSessionOptions(adminSecret: "admin-a", sessionVariables: ["org-id": "org-1"])
            )
        ]

        let digests = Set(scopes.map(\.digest))
        XCTAssertEqual(digests.count, scopes.count)
        XCTAssertTrue(scopes.allSatisfy { $0.digest.rawValue.count == 64 })
        XCTAssertTrue(scopes.allSatisfy { !$0.digest.rawValue.contains("user-1") })
        XCTAssertTrue(scopes.allSatisfy { !$0.digest.rawValue.contains("admin-a") })
    }

    func testStableTokenRefreshKeepsScopeWhileClaimsChangeDoesNot() async throws {
        let firstSession = try session(subject: "user-1", exp: testNowSeconds + 60, iat: testNowSeconds)
        let store = SessionStore(storage: MemorySessionStorageBackend(session: firstSession))
        let firstSnapshot = try await store.authorizationSnapshot()
        let firstScope = try await scope(snapshot: firstSnapshot)
        let refreshed = try session(
            subject: "user-1",
            exp: testNowSeconds + 3_600,
            iat: testNowSeconds + 30
        )

        _ = try await store.set(refreshed)
        let refreshSnapshot = try await store.authorizationSnapshot()
        let refreshScope = try await scope(snapshot: refreshSnapshot)
        XCTAssertEqual(refreshSnapshot.authorizationEpoch, firstSnapshot.authorizationEpoch)
        XCTAssertEqual(refreshScope.digest, firstScope.digest)

        let changed = try session(
            subject: "user-1",
            hasuraClaims: [
                "x-hasura-default-role": "editor",
                "x-hasura-allowed-roles": "{user,editor}"
            ]
        )
        _ = try await store.set(changed)
        let changedSnapshot = try await store.authorizationSnapshot()
        let changedScope = try await scope(snapshot: changedSnapshot)
        XCTAssertNotEqual(changedScope.digest, firstScope.digest)
        XCTAssertEqual(changedSnapshot.authorizationEpoch, firstSnapshot.authorizationEpoch + 1)
    }

    func testEffectiveRolePrecedenceMatchesKnownMiddleware() async throws {
        let managed = try await snapshot(session: try session(subject: "user-1"))
        let caller = try await scope(
            snapshot: managed,
            headers: ["X-Hasura-Role": "caller"],
            defaults: ["x-hasura-role": "default"],
            configuredRole: "configured",
            admin: AdminSessionOptions(adminSecret: "secret", role: "admin")
        )
        let admin = try await scope(
            snapshot: managed,
            defaults: ["x-hasura-role": "default"],
            configuredRole: "configured",
            admin: AdminSessionOptions(adminSecret: "secret", role: "admin")
        )
        let defaults = try await scope(
            snapshot: managed,
            defaults: ["X-Hasura-Role": "default"],
            configuredRole: "configured"
        )
        let configured = try await scope(snapshot: managed, configuredRole: "configured")
        let token = try await scope(snapshot: managed)

        XCTAssertEqual(caller.sdkScope.effectiveRole, "caller")
        XCTAssertEqual(admin.sdkScope.effectiveRole, "admin")
        XCTAssertEqual(defaults.sdkScope.effectiveRole, "default")
        XCTAssertEqual(configured.sdkScope.effectiveRole, "configured")
        XCTAssertEqual(token.sdkScope.effectiveRole, "user")
    }
}

extension GraphQLCacheScopeTests {
    func testFinalVerificationAcceptsStableManagedRefreshAndExactKnownHeaders() async throws {
        let first = try session(subject: "user-1", exp: testNowSeconds + 60, iat: testNowSeconds)
        let store = SessionStore(storage: MemorySessionStorageBackend(session: first))
        let initialSnapshot = try await store.authorizationSnapshot()
        let preflight = try await scope(
            snapshot: initialSnapshot,
            defaults: ["x-client-variant": "ios", "x-hasura-org-id": "org-1"]
        )
        let refreshed = try session(
            subject: "user-1",
            exp: testNowSeconds + 3_600,
            iat: testNowSeconds + 30
        )
        _ = try await store.set(refreshed)
        let finalSnapshot = try await store.authorizationSnapshot()
        let body = try NhostJSON.neutralEncoder.encode(graphQLRequest)
        let terminal = NhostRequest(
            method: "POST",
            url: endpoint,
            headers: [
                "Authorization": "Bearer \(refreshed.accessToken)",
                "x-client-variant": "ios",
                "X-Hasura-Org-Id": "org-1"
            ],
            body: body
        )

        let result = try preflight.verify(
            transcript: NhostTerminalRequestTranscript(requests: [terminal]),
            expectedURL: endpoint,
            expectedBody: body,
            currentSessionSnapshot: finalSnapshot
        )
        XCTAssertEqual(result, .verified)
    }

    func testKnownMiddlewareTerminalRequestMatchesPreflight() async throws {
        let managedSession = try session(subject: "user-1")
        let store = SessionStore(storage: MemorySessionStorageBackend(session: managedSession))
        let snapshot = try await store.authorizationSnapshot()
        let admin = AdminSessionOptions(
            adminSecret: "secret",
            role: "admin",
            sessionVariables: ["org-id": "org-1"]
        )
        let defaults = ["x-client-variant": "ios", "x-hasura-role": "default"]
        let preflight = try await scope(
            snapshot: snapshot,
            defaults: defaults,
            configuredRole: "configured",
            admin: admin
        )
        let pipeline = NhostFetchPipeline(
            transport: StubTransport { _ in NhostRawResponse(status: 200) },
            middleware: [
                attachAccessTokenMiddleware(sessionStore: store),
                adminSessionMiddleware(admin),
                headersMiddleware(defaults),
                roleMiddleware("configured")
            ]
        )
        let body = try NhostJSON.neutralEncoder.encode(graphQLRequest)
        let result = try await pipeline.sendCapturingTerminalRequests(
            NhostRequest(method: "POST", url: endpoint, body: body)
        )
        let captured = try XCTUnwrap(result)
        let current = try await store.authorizationSnapshot()

        XCTAssertEqual(
            try preflight.verify(
                transcript: captured.transcript,
                expectedURL: endpoint,
                expectedBody: body,
                currentSessionSnapshot: current
            ),
            .verified
        )
    }

    func testFinalVerificationFailsClosedForProtectedStateOrEpochChanges() async throws {
        let initial = try session(subject: "user-1")
        let store = SessionStore(storage: MemorySessionStorageBackend(session: initial))
        let snapshot = try await store.authorizationSnapshot()
        let preflight = try await scope(snapshot: snapshot)
        let body = try NhostJSON.neutralEncoder.encode(graphQLRequest)
        let wrongAuthorization = NhostRequest(
            method: "POST", url: endpoint, headers: ["Authorization": "Bearer explicit"], body: body
        )

        XCTAssertThrowsError(
            try preflight.verify(
                transcript: NhostTerminalRequestTranscript(requests: [wrongAuthorization]),
                expectedURL: endpoint,
                expectedBody: body,
                currentSessionSnapshot: snapshot
            )
        ) { error in
            XCTAssertEqual(error as? GraphQLCacheError, .authorizationScopeChanged)
        }

        _ = try await store.set(try session(subject: "user-2"))
        let changedSnapshot = try await store.authorizationSnapshot()
        let oldTerminal = NhostRequest(
            method: "POST", url: endpoint,
            headers: ["Authorization": "Bearer \(initial.accessToken)"], body: body
        )
        XCTAssertThrowsError(
            try preflight.verify(
                transcript: NhostTerminalRequestTranscript(requests: [oldTerminal]),
                expectedURL: endpoint,
                expectedBody: body,
                currentSessionSnapshot: changedSnapshot
            )
        ) { error in
            XCTAssertEqual(error as? GraphQLCacheError, .authorizationScopeChanged)
        }
    }

    func testStructuralTranscriptMismatchesAreUnverifiable() async throws {
        let snapshot = try await snapshot(session: nil)
        let preflight = try await scope(snapshot: snapshot, usesManagedSession: false)
        let body = try NhostJSON.neutralEncoder.encode(graphQLRequest)
        let matching = NhostRequest(method: "POST", url: endpoint, body: body)
        let rewrittenURL = NhostRequest(
            method: "POST", url: URL(string: "https://other.example.test/v1")!, body: body
        )
        let rewrittenBody = NhostRequest(method: "POST", url: endpoint, body: Data("other".utf8))
        let rewrittenMethod = NhostRequest(method: "GET", url: endpoint, body: body)

        for transcript in [
            NhostTerminalRequestTranscript(requests: []),
            NhostTerminalRequestTranscript(requests: [matching, matching]),
            NhostTerminalRequestTranscript(requests: [matching, rewrittenURL]),
            NhostTerminalRequestTranscript(requests: [rewrittenURL]),
            NhostTerminalRequestTranscript(requests: [rewrittenBody]),
            NhostTerminalRequestTranscript(requests: [rewrittenMethod])
        ] {
            let result = try preflight.verify(
                transcript: transcript,
                expectedURL: endpoint,
                expectedBody: body,
                currentSessionSnapshot: snapshot
            )
            XCTAssertEqual(result, .unverifiable)
        }
    }
}

extension GraphQLCacheScopeTests {
    func testCustomMiddlewareBypassesWithoutResolverAndResolverIsVerified() async throws {
        let managed = try await snapshot(session: try session(subject: "user-1"))
        let inputs = GraphQLCacheScopeInputs(
            endpoint: endpoint,
            request: graphQLRequest,
            sessionSnapshot: managed,
            usesManagedSession: true,
            hasCustomMiddleware: true
        )
        let unresolvedWithoutResolver = try await inputs.resolve()
        let unresolvedWithNilResolver = try await inputs.resolve(resolver: { _ in nil })
        XCTAssertNil(unresolvedWithoutResolver)
        XCTAssertNil(unresolvedWithNilResolver)

        let resolved = try await inputs.resolve { context in
            XCTAssertEqual(context.sdkScope.authorizationMode, .managedSession)
            XCTAssertNil(context.headers["Authorization"])
            return GraphQLCacheCustomScope(
                identifier: "custom-auth-v1",
                protectedHeaders: ["Authorization": "Custom credential"],
                varyHeaders: ["x-tenant": "tenant-a"]
            )
        }
        let preflight = try XCTUnwrap(resolved)
        let body = try NhostJSON.neutralEncoder.encode(graphQLRequest)
        let terminal = NhostRequest(
            method: "POST",
            url: endpoint,
            headers: ["authorization": "Custom credential", "X-Tenant": "tenant-a"],
            body: body
        )
        XCTAssertEqual(
            try preflight.verify(
                transcript: NhostTerminalRequestTranscript(requests: [terminal]),
                expectedURL: endpoint,
                expectedBody: body,
                currentSessionSnapshot: managed
            ),
            .verified
        )

        assertScopeChanged(
            preflight,
            snapshot: managed,
            body: body,
            headers: ["authorization": "Custom credential", "x-tenant": "tenant-b"]
        )
    }

    func testConflictingCaseInsensitiveProtectedHeadersMakeScopeUnavailable() async throws {
        let snapshot = try await snapshot(session: nil)
        let inputs = GraphQLCacheScopeInputs(
            endpoint: endpoint,
            request: graphQLRequest,
            requestHeaders: ["Authorization": "one", "authorization": "two"],
            sessionSnapshot: snapshot,
            usesManagedSession: false
        )

        do {
            _ = try await inputs.resolve()
            XCTFail("Expected unavailable scope")
        } catch {
            XCTAssertEqual(error as? GraphQLCacheError, .unavailableScope)
        }
    }

    private func assertScopeChanged(
        _ preflight: GraphQLCachePreflightScope,
        snapshot: SessionAuthorizationSnapshot,
        body: Data,
        headers: [String: String]
    ) {
        let terminal = NhostRequest(method: "POST", url: endpoint, headers: headers, body: body)
        XCTAssertThrowsError(
            try preflight.verify(
                transcript: NhostTerminalRequestTranscript(requests: [terminal]),
                expectedURL: endpoint,
                expectedBody: body,
                currentSessionSnapshot: snapshot
            )
        ) { error in
            XCTAssertEqual(error as? GraphQLCacheError, .authorizationScopeChanged)
        }
    }

    private func session(
        subject: String,
        exp: Int = testNowSeconds + 3_600,
        iat: Int = testNowSeconds,
        hasuraClaims: [String: Any] = [
            "x-hasura-default-role": "user",
            "x-hasura-allowed-roles": "{user,editor}"
        ]
    ) throws -> StoredSession {
        let token = try testAccessToken(
            exp: exp,
            iat: iat,
            subject: subject,
            hasuraClaims: hasuraClaims
        )
        return try StoredSession(try testAuthSession(exp: exp, accessToken: token))
    }

    private func snapshot(session: StoredSession?) async throws -> SessionAuthorizationSnapshot {
        let backend = MemorySessionStorageBackend(session: session)
        return try await SessionStore(storage: backend).authorizationSnapshot()
    }
    private func scope(
        snapshot: SessionAuthorizationSnapshot,
        usesManagedSession: Bool = true,
        headers: [String: String] = [:],
        defaults: [String: String] = [:],
        configuredRole: String? = nil,
        admin: AdminSessionOptions? = nil
    ) async throws -> GraphQLCachePreflightScope {
        let resolved = try await GraphQLCacheScopeInputs(
            endpoint: endpoint,
            request: graphQLRequest,
            requestHeaders: headers,
            defaultHeaders: defaults,
            configuredRole: configuredRole,
            adminSession: admin,
            sessionSnapshot: snapshot,
            usesManagedSession: usesManagedSession
        ).resolve()
        return try XCTUnwrap(resolved)
    }
}
