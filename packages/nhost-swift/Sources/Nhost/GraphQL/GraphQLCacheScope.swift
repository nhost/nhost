import Foundation

enum GraphQLCacheFinalRequestVerification: Sendable, Equatable {
    case verified
    case unverifiable
}

/// Known SDK state used to derive a protected scope without executing middleware.
/// Phase 4 consumes this model when cache policy orchestration is enabled.
struct GraphQLCacheScopeInputs: Sendable {
    let endpoint: URL
    let request: GraphQLRequest
    let requestHeaders: [String: String]
    let defaultHeaders: [String: String]
    let configuredRole: String?
    let adminSession: AdminSessionOptions?
    let sessionSnapshot: SessionAuthorizationSnapshot?
    let usesManagedSession: Bool
    let hasCustomMiddleware: Bool

    init(
        endpoint: URL,
        request: GraphQLRequest,
        requestHeaders: [String: String] = [:],
        defaultHeaders: [String: String] = [:],
        configuredRole: String? = nil,
        adminSession: AdminSessionOptions? = nil,
        sessionSnapshot: SessionAuthorizationSnapshot?,
        usesManagedSession: Bool,
        hasCustomMiddleware: Bool = false
    ) {
        self.endpoint = endpoint
        self.request = request
        self.requestHeaders = requestHeaders
        self.defaultHeaders = defaultHeaders
        self.configuredRole = configuredRole
        self.adminSession = adminSession
        self.sessionSnapshot = sessionSnapshot
        self.usesManagedSession = usesManagedSession
        self.hasCustomMiddleware = hasCustomMiddleware
    }

    func resolve(
        resolver: GraphQLCacheScopeResolver? = nil
    ) async throws -> GraphQLCachePreflightScope? {
        let base = try deriveBaseScope()
        let customScope: GraphQLCacheCustomScope?

        if let resolver {
            do {
                customScope = try await resolver(
                    GraphQLCacheScopeResolverContext(
                        endpoint: endpoint,
                        request: request,
                        headers: requestHeaders,
                        sdkScope: base.sdkScope
                    )
                )
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                throw GraphQLCacheError.unavailableScope
            }
            guard customScope != nil else { return nil }
        } else {
            guard !hasCustomMiddleware else { return nil }
            customScope = nil
        }

        return try base.augmenting(customScope)
    }

    private func deriveBaseScope() throws -> GraphQLCachePreflightScope {
        let caller = try GraphQLProtectedHeaders.normalized(requestHeaders)
        let defaults = try GraphQLProtectedHeaders.normalized(defaultHeaders)
        var effective = caller

        let callerAuthorization = caller["authorization"]
        var managedSession: StoredSession?
        if callerAuthorization == nil,
           usesManagedSession,
           let session = sessionSnapshot?.session,
           !session.accessToken.isEmpty {
            effective["authorization"] = "Bearer \(session.accessToken)"
            managedSession = session
        }

        if let adminSession {
            GraphQLProtectedHeaders.setIfAbsent(
                "x-hasura-admin-secret",
                value: adminSession.adminSecret,
                on: &effective
            )
            if let role = adminSession.role {
                GraphQLProtectedHeaders.setIfAbsent("x-hasura-role", value: role, on: &effective)
            }
            for (name, value) in adminSession.sessionVariables {
                let normalizedName = name.lowercased().hasPrefix("x-hasura-")
                    ? name.lowercased()
                    : "x-hasura-\(name.lowercased())"
                GraphQLProtectedHeaders.setIfAbsent(normalizedName, value: value, on: &effective)
            }
        }

        for (name, value) in defaults {
            GraphQLProtectedHeaders.setIfAbsent(name, value: value, on: &effective)
        }
        if let configuredRole {
            GraphQLProtectedHeaders.setIfAbsent("x-hasura-role", value: configuredRole, on: &effective)
        }

        let authorizationExpectation: GraphQLAuthorizationExpectation
        let explicitAuthorization: String?
        if let callerAuthorization {
            authorizationExpectation = .exact(callerAuthorization)
            explicitAuthorization = callerAuthorization
        } else if let managedSession {
            authorizationExpectation = .managedClaims(managedSession.stableClaimsFingerprint)
            explicitAuthorization = nil
        } else if let authorization = effective["authorization"] {
            authorizationExpectation = .exact(authorization)
            explicitAuthorization = authorization
        } else {
            authorizationExpectation = .absent
            explicitAuthorization = nil
        }

        let adminSecret = effective["x-hasura-admin-secret"]
        let effectiveRole = effective["x-hasura-role"] ?? managedSession?.decodedToken.defaultHasuraRole
        let sessionVariables = effective.filter {
            $0.key.hasPrefix("x-hasura-")
                && $0.key != "x-hasura-role"
                && $0.key != "x-hasura-admin-secret"
        }
        let varyHeaders = effective.filter {
            !GraphQLProtectedHeaders.nonVaryHeaderNames.contains($0.key)
                && $0.key != "authorization"
                && !$0.key.hasPrefix("x-hasura-")
        }

        let authorizationMode = Self.authorizationMode(
            explicitAuthorization: explicitAuthorization,
            adminSecret: adminSecret,
            managedSession: managedSession
        )
        let userIdentity = managedSession?.stableUserIdentity
        let sdkScope = Self.sdkScope(
            mode: authorizationMode,
            effectiveRole: effectiveRole,
            userIdentity: userIdentity
        )
        let protectedHeaders = sessionVariables.merging(varyHeaders) { _, new in new }
        let epoch = managedSession == nil ? nil : sessionSnapshot?.authorizationEpoch
        let sessionFingerprint = managedSession?.stableAuthorizationFingerprint
        let digest = GraphQLProtectedHeaders.scopeDigest(
            GraphQLScopeDigestInputs(
                authorizationMode: authorizationMode,
                sessionFingerprint: sessionFingerprint,
                explicitAuthorization: explicitAuthorization,
                adminSecret: adminSecret,
                effectiveRole: effectiveRole,
                protectedHeaders: protectedHeaders
            )
        )

        return GraphQLCachePreflightScope(
            digest: digest,
            userIdentity: userIdentity,
            sdkScope: sdkScope,
            authorizationExpectation: authorizationExpectation,
            expectedAdminSecret: adminSecret,
            expectedRole: effectiveRole,
            expectedHeaders: protectedHeaders,
            authorizationEpoch: epoch,
            stableSessionFingerprint: sessionFingerprint
        )
    }

    private static func authorizationMode(
        explicitAuthorization: String?,
        adminSecret: String?,
        managedSession: StoredSession?
    ) -> GraphQLCacheSDKScope.AuthorizationMode {
        if explicitAuthorization != nil { return .explicitAuthorization }
        if adminSecret != nil { return .admin }
        if managedSession != nil { return .managedSession }
        return .anonymous
    }

    private static func sdkScope(
        mode: GraphQLCacheSDKScope.AuthorizationMode,
        effectiveRole: String?,
        userIdentity: String?
    ) -> GraphQLCacheSDKScope {
        GraphQLCacheSDKScope(
            authorizationMode: mode,
            effectiveRole: effectiveRole,
            userIdentityDigest: userIdentity.map {
                GraphQLCacheKeyBuilder.facetDigest(domain: "user", value: $0).rawValue
            }
        )
    }
}

struct GraphQLCachePreflightScope: Sendable {
    let digest: GraphQLCacheDigest
    let userIdentity: String?
    let sdkScope: GraphQLCacheSDKScope

    private let authorizationExpectation: GraphQLAuthorizationExpectation
    private let expectedAdminSecret: String?
    private let expectedRole: String?
    private let expectedHeaders: [String: String]
    private let authorizationEpoch: UInt64?
    private let stableSessionFingerprint: String?

    fileprivate init(
        digest: GraphQLCacheDigest,
        userIdentity: String?,
        sdkScope: GraphQLCacheSDKScope,
        authorizationExpectation: GraphQLAuthorizationExpectation,
        expectedAdminSecret: String?,
        expectedRole: String?,
        expectedHeaders: [String: String],
        authorizationEpoch: UInt64?,
        stableSessionFingerprint: String?
    ) {
        self.digest = digest
        self.userIdentity = userIdentity
        self.sdkScope = sdkScope
        self.authorizationExpectation = authorizationExpectation
        self.expectedAdminSecret = expectedAdminSecret
        self.expectedRole = expectedRole
        self.expectedHeaders = expectedHeaders
        self.authorizationEpoch = authorizationEpoch
        self.stableSessionFingerprint = stableSessionFingerprint
    }

    func verify(
        transcript: NhostTerminalRequestTranscript,
        expectedURL: URL,
        expectedBody: Data,
        currentSessionSnapshot: SessionAuthorizationSnapshot?
    ) throws -> GraphQLCacheFinalRequestVerification {
        guard transcript.requests.count == 1, let request = transcript.requests.first,
              request.method.uppercased() == "POST",
              request.bodyFileURL == nil,
              request.body == expectedBody,
              GraphQLCacheKeyBuilder.canonicalEndpoint(request.url)
                == GraphQLCacheKeyBuilder.canonicalEndpoint(expectedURL)
        else {
            return .unverifiable
        }

        let finalHeaders: [String: String]
        do {
            finalHeaders = try GraphQLProtectedHeaders.normalized(request.headers)
        } catch {
            throw GraphQLCacheError.authorizationScopeChanged
        }

        try verifyProtectedHeaders(finalHeaders)
        try verifySessionSnapshot(currentSessionSnapshot)
        return .verified
    }

    private func verifyProtectedHeaders(_ finalHeaders: [String: String]) throws {
        let finalAuthorization = finalHeaders["authorization"]
        let expectedAuthorization = expectedHeaders["authorization"]
        let authorizationMatches = expectedAuthorization.map { finalAuthorization == $0 }
            ?? authorizationExpectation.matches(finalAuthorization)
        let finalEffectiveRole = finalHeaders["x-hasura-role"]
            ?? authorizationExpectation.managedDefaultRole(from: finalAuthorization)
        let finalExpectedRole = if expectedAuthorization != nil {
            expectedHeaders["x-hasura-role"]
        } else {
            expectedHeaders["x-hasura-role"] ?? expectedRole
        }
        let finalAdminSecret = finalHeaders["x-hasura-admin-secret"]
        let expectedAdminSecret = expectedHeaders["x-hasura-admin-secret"] ?? self.expectedAdminSecret
        let expectedVariables = Self.sessionVariables(in: expectedHeaders)
        let finalVariables = Self.sessionVariables(in: finalHeaders)
        guard authorizationMatches,
              finalAdminSecret == expectedAdminSecret,
              finalEffectiveRole == finalExpectedRole,
              finalVariables == expectedVariables,
              expectedHeaders.allSatisfy({ finalHeaders[$0.key] == $0.value })
        else {
            throw GraphQLCacheError.authorizationScopeChanged
        }
    }

    func verifyCurrentSessionSnapshot(_ snapshot: SessionAuthorizationSnapshot?) throws {
        try verifySessionSnapshot(snapshot)
    }

    private func verifySessionSnapshot(_ snapshot: SessionAuthorizationSnapshot?) throws {
        guard let authorizationEpoch, let stableSessionFingerprint else { return }
        guard let snapshot,
              snapshot.authorizationEpoch == authorizationEpoch,
              snapshot.stableFingerprint == stableSessionFingerprint
        else {
            throw GraphQLCacheError.authorizationScopeChanged
        }
    }

    private static func sessionVariables(in headers: [String: String]) -> [String: String] {
        headers.filter {
            $0.key.hasPrefix("x-hasura-")
                && $0.key != "x-hasura-role"
                && $0.key != "x-hasura-admin-secret"
        }
    }

    fileprivate func augmenting(_ custom: GraphQLCacheCustomScope?) throws -> GraphQLCachePreflightScope {
        guard let custom else { return self }
        let customProtected = try GraphQLProtectedHeaders.normalized(custom.protectedHeaders)
        let customVary = try GraphQLProtectedHeaders.normalized(custom.varyHeaders)
        for (name, value) in customProtected {
            if let varyValue = customVary[name], varyValue != value {
                throw GraphQLCacheError.unavailableScope
            }
        }
        let customHeaders = customProtected.merging(customVary) { existing, _ in existing }
        let augmentedHeaders = expectedHeaders.merging(customHeaders) { _, new in new }
        let digest = GraphQLProtectedHeaders.augmentedScopeDigest(
            base: self.digest,
            customIdentifier: custom.identifier,
            customHeaders: customHeaders
        )
        return GraphQLCachePreflightScope(
            digest: digest,
            userIdentity: userIdentity,
            sdkScope: sdkScope,
            authorizationExpectation: authorizationExpectation,
            expectedAdminSecret: expectedAdminSecret,
            expectedRole: expectedRole,
            expectedHeaders: augmentedHeaders,
            authorizationEpoch: authorizationEpoch,
            stableSessionFingerprint: stableSessionFingerprint
        )
    }
}
