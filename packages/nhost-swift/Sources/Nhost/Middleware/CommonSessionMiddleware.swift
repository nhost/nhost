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

/// Managed-session failures that occur before or after an Auth request.
public enum ManagedSessionError: Error, Sendable, Equatable {
    /// A credential-consuming operation was attempted without a stored session.
    case noSession(operation: String)
    /// A direct refresh attempted to consume a token other than the current one.
    case refreshTokenMismatch
    /// A managed Auth request body could not be decoded after ownership was acquired.
    case invalidRequestBody(operation: String)
    /// User middleware changed or repeated a request whose session policy had already been selected.
    case managedRequestWasRewritten
    /// Managed Auth was called recursively while the current task held the session lease.
    case reentrantManagedOperation
    /// Auth succeeded remotely, but the SDK could not prove the matching local clear succeeded.
    case localSessionStateUncertain(operation: String)
}

extension ManagedSessionError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case let .noSession(operation):
            "The managed Auth operation \(operation) requires a stored session."
        case .refreshTokenMismatch:
            "The supplied refresh token is not the current managed-session token."
        case let .invalidRequestBody(operation):
            "The managed Auth request body for \(operation) is invalid."
        case .managedRequestWasRewritten:
            "User middleware may not rewrite or repeat a classified managed Auth request."
        case .reentrantManagedOperation:
            "A managed Auth operation cannot be nested while the session transaction is active."
        case let .localSessionStateUncertain(operation):
            "Auth completed \(operation) remotely, but the local session could not be cleared reliably."
        }
    }
}

func attachAccessTokenMiddleware(sessionStore: SessionStore) -> ChainFunction {
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

/// Internal compatibility helper for focused refresh tests. Production clients
/// use `managedSessionMiddleware`, which owns refresh, attachment, and mutation
/// policy in one classifier.
func sessionRefreshMiddleware(
    refresher: SessionRefresher,
    marginSeconds: Int = 60
) -> ChainFunction {
    { request, next in
        if NhostHeaderLookup.hasHeader(request.headers, named: "Authorization") {
            return try await next(request)
        }

        _ = try await refresher.refreshSession(marginSeconds: marginSeconds)
        return try await next(request)
    }
}

func sessionRefreshMiddleware(
    auth: AuthClient,
    sessionStore: SessionStore,
    marginSeconds: Int = 60
) -> ChainFunction {
    sessionRefreshMiddleware(
        refresher: SessionRefresher(auth: auth, store: sessionStore),
        marginSeconds: marginSeconds
    )
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
