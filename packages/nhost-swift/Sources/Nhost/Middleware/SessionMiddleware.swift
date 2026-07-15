import Foundation

public struct AdminSessionOptions: Sendable, Equatable {
    public let adminSecret: String
    public let role: String?
    public let sessionVariables: [String: String]

    public init(
        adminSecret: String,
        role: String? = nil,
        sessionVariables: [String: String] = [:]
    ) {
        self.adminSecret = adminSecret
        self.role = role
        self.sessionVariables = sessionVariables
    }
}

public func attachAccessTokenMiddleware(sessionStore: SessionStore) -> ChainFunction {
    { request, next in
        guard !NhostHeaderLookup.hasHeader(request.headers, named: "Authorization") else {
            return try await next(request)
        }

        let snapshot = try await sessionStore.authorizationSnapshot()
        guard let session = snapshot.session, !session.accessToken.isEmpty else {
            return try await next(request)
        }

        var request = request
        request.setHeader("Authorization", "Bearer \(session.accessToken)")
        return try await next(request)
    }
}

public func sessionRefreshMiddleware(
    refresher: SessionRefresher,
    marginSeconds: Int = 60
) -> ChainFunction {
    { request, next in
        if NhostHeaderLookup.hasHeader(request.headers, named: "Authorization")
            || NhostMiddlewareRequestClassifier.isRefreshTokenEndpoint(request.url) {
            return try await next(request)
        }

        _ = try await refresher.refreshSession(marginSeconds: marginSeconds)
        return try await next(request)
    }
}

public func sessionRefreshMiddleware(
    auth: AuthClient,
    sessionStore: SessionStore,
    marginSeconds: Int = 60
) -> ChainFunction {
    sessionRefreshMiddleware(
        refresher: SessionRefresher(auth: auth, store: sessionStore),
        marginSeconds: marginSeconds
    )
}

public func updateSessionFromResponseMiddleware(sessionStore: SessionStore) -> ChainFunction {
    { request, next in
        let response = try await next(request)
        await updateSessionStore(sessionStore, from: response, request: request)
        return response
    }
}

public func headersMiddleware(_ defaultHeaders: [String: String]) -> ChainFunction {
    { request, next in
        var request = request

        for (name, value) in defaultHeaders {
            NhostHeaderLookup.setHeaderIfAbsent(name, value, on: &request)
        }

        return try await next(request)
    }
}

public func roleMiddleware(_ role: String) -> ChainFunction {
    { request, next in
        var request = request
        NhostHeaderLookup.setHeaderIfAbsent("x-hasura-role", role, on: &request)
        return try await next(request)
    }
}

public func adminSessionMiddleware(_ options: AdminSessionOptions) -> ChainFunction {
    { request, next in
        var request = request
        NhostHeaderLookup.setHeaderIfAbsent("x-hasura-admin-secret", options.adminSecret, on: &request)

        if let role = options.role {
            NhostHeaderLookup.setHeaderIfAbsent("x-hasura-role", role, on: &request)
        }

        for (key, value) in options.sessionVariables {
            let header = key.lowercased().hasPrefix("x-hasura-") ? key : "x-hasura-\(key)"
            NhostHeaderLookup.setHeaderIfAbsent(header, value, on: &request)
        }

        return try await next(request)
    }
}

private func updateSessionStore(
    _ sessionStore: SessionStore,
    from response: NhostRawResponse,
    request: NhostRequest
) async {
    let path = request.url.path

    if path.hasSuffix("/signout") {
        try? await sessionStore.remove()
        return
    }

    if path.hasSuffix("/user/password"), response.isSuccess {
        try? await sessionStore.remove()
        return
    }

    guard NhostMiddlewareRequestClassifier.mayReturnSession(request.url),
          let session = extractSession(from: response.body),
          !session.accessToken.isEmpty,
          !session.refreshToken.isEmpty
    else {
        return
    }

    _ = try? await sessionStore.set(session)
}

private func extractSession(from body: Data) -> AuthSession? {
    guard !body.isEmpty else { return nil }

    if let payload = try? NhostJSON.restDecoder.decode(AuthSessionPayload.self, from: body),
       let session = payload.session {
        return session
    }

    return try? NhostJSON.restDecoder.decode(AuthSession.self, from: body)
}

private enum NhostMiddlewareRequestClassifier {
    static func isRefreshTokenEndpoint(_ url: URL) -> Bool {
        url.path.hasSuffix("/token")
    }

    static func mayReturnSession(_ url: URL) -> Bool {
        let path = url.path
        return path.hasSuffix("/token")
            || path.contains("/token/exchange")
            || path.contains("/signin/")
            || path.contains("/signup/")
    }
}
