import Foundation

/// Unified middleware for proactive refresh, authorization, and every managed
/// Auth credential mutation. `authBaseURL == nil` selects ordinary protected
/// service behavior; an Auth base URL enables the exhaustive operation matrix.
func managedSessionMiddleware(
    authBaseURL: URL?,
    sessionStore: SessionStore,
    refresher: SessionRefresher?,
    marginSeconds: Int
) -> ChainFunction {
    let classifier = authBaseURL.map(ManagedAuthRequestClassifier.init)
    let environment = ManagedSessionExecutionEnvironment(
        store: sessionStore,
        refresher: refresher,
        marginSeconds: marginSeconds
    )

    return { request, next in
        if let classifier {
            let operation = classifier.operation(for: request)
            if ManagedSessionTaskContext.holdsLease, operation != nil {
                throw ManagedSessionError.reentrantManagedOperation
            }
            return try await executeManagedAuthRequest(
                request,
                operation: operation,
                next: next,
                environment: environment
            )
        }

        if ManagedSessionTaskContext.holdsLease {
            throw ManagedSessionError.reentrantManagedOperation
        }
        return try await executeOrdinaryManagedRequest(
            request,
            operation: nil,
            next: next,
            environment: environment
        )
    }
}

/// Runs innermost, after user middleware, and verifies that the exact operation
/// classified before user middleware is still the operation sent to transport.
func managedAuthRequestValidationMiddleware(authBaseURL: URL) -> ChainFunction {
    let classifier = ManagedAuthRequestClassifier(baseURL: authBaseURL)
    return { request, next in
        if let expectation = ManagedSessionTaskContext.requestExpectation {
            try expectation.validateTerminalRequest(request, operation: classifier.operation(for: request))
        }
        return try await next(request)
    }
}

private struct ManagedSessionExecutionEnvironment: Sendable {
    let store: SessionStore
    let refresher: SessionRefresher?
    let marginSeconds: Int
}

private func executeManagedAuthRequest(
    _ request: NhostRequest,
    operation: ManagedAuthOperationAudit?,
    next: @escaping FetchFunction,
    environment: ManagedSessionExecutionEnvironment
) async throws -> NhostRawResponse {
    guard let operation else {
        return try await sendExpectedRequest(request, operation: nil, next: next)
    }

    guard operation.policy.fullTransaction else {
        if operation.policy.authorization {
            let ordinaryEnvironment = ManagedSessionExecutionEnvironment(
                store: environment.store,
                refresher: operation.policy.proactiveRefresh ? environment.refresher : nil,
                marginSeconds: environment.marginSeconds
            )
            return try await executeOrdinaryManagedRequest(
                request,
                operation: operation,
                next: next,
                environment: ordinaryEnvironment
            )
        }
        return try await sendExpectedRequest(request, operation: operation, next: next)
    }

    do {
        return try await environment.store.withTransaction { context in
            try await ManagedSessionTaskContext.$holdsLease.withValue(true) {
                try await executeManagedAuthTransaction(
                    request,
                    operation: operation,
                    next: next,
                    context: context,
                    environment: environment
                )
            }
        }
    } catch SessionCoordinationError.reentrantAcquisition {
        throw ManagedSessionError.reentrantManagedOperation
    }
}

private func executeOrdinaryManagedRequest(
    _ request: NhostRequest,
    operation: ManagedAuthOperationAudit?,
    next: @escaping FetchFunction,
    environment: ManagedSessionExecutionEnvironment
) async throws -> NhostRawResponse {
    if let refresher = environment.refresher {
        _ = try await refresher.refreshSession(marginSeconds: environment.marginSeconds)
    }
    let snapshot = try await environment.store.authorizationSnapshot()
    let prepared = attachAuthorization(to: request, session: snapshot.session, replacingExisting: false)
    return try await sendExpectedRequest(prepared, operation: operation, next: next)
}

private func executeManagedAuthTransaction(
    _ request: NhostRequest,
    operation: ManagedAuthOperationAudit,
    next: @escaping FetchFunction,
    context: SessionTransactionContext,
    environment: ManagedSessionExecutionEnvironment
) async throws -> NhostRawResponse {
    switch operation.policy.outcomeMutation {
    case .persistSession:
        try await executeSessionProducer(
            request,
            operation: operation,
            next: next,
            context: context,
            environment: environment
        )
    case .persistDirectRefresh:
        try await executeDirectRefresh(request, operation: operation, next: next, context: context)
    case .clearSession:
        try await executeClearOperation(
            request,
            operation: operation,
            next: next,
            context: context,
            environment: environment
        )
    case .none:
        try await sendExpectedRequest(request, operation: operation, next: next)
    }
}

private func executeSessionProducer(
    _ request: NhostRequest,
    operation: ManagedAuthOperationAudit,
    next: @escaping FetchFunction,
    context: SessionTransactionContext,
    environment: ManagedSessionExecutionEnvironment
) async throws -> NhostRawResponse {
    let session: StoredSession?
    if operation.policy.proactiveRefresh {
        session = try await currentSession(
            context: context,
            refresher: environment.refresher,
            marginSeconds: environment.marginSeconds
        )
    } else {
        session = nil
    }
    let prepared = operation.policy.authorization
        ? attachAuthorization(to: request, session: session, replacingExisting: true)
        : request
    let response = try await sendExpectedRequest(prepared, operation: operation, next: next)
    if response.isSuccess, let returnedSession = try decodePayloadSession(response.body) {
        try await context.set(returnedSession)
    }
    try Task.checkCancellation()
    return response
}

private func executeDirectRefresh(
    _ request: NhostRequest,
    operation: ManagedAuthOperationAudit,
    next: @escaping FetchFunction,
    context: SessionTransactionContext
) async throws -> NhostRawResponse {
    let refreshRequest: AuthRefreshTokenRequest
    do {
        guard let body = request.body else {
            throw ManagedSessionError.invalidRequestBody(operation: operation.operationID)
        }
        refreshRequest = try NhostJSON.restDecoder.decode(AuthRefreshTokenRequest.self, from: body)
    } catch let error as ManagedSessionError {
        throw error
    } catch {
        throw ManagedSessionError.invalidRequestBody(operation: operation.operationID)
    }

    guard let stored = try await context.get() else {
        throw ManagedSessionError.noSession(operation: operation.operationID)
    }
    guard stored.refreshToken == refreshRequest.refreshToken else {
        throw ManagedSessionError.refreshTokenMismatch
    }

    let response = try await sendExpectedRequest(request, operation: operation, next: next)
    if response.isSuccess {
        let authSession: AuthSession
        do {
            authSession = try NhostJSON.restDecoder.decode(AuthSession.self, from: response.body)
        } catch {
            throw FetchError.decoding(String(describing: error))
        }
        try await context.set(StoredSession(authSession))
    }
    try Task.checkCancellation()
    return response
}

private func executeClearOperation(
    _ request: NhostRequest,
    operation: ManagedAuthOperationAudit,
    next: @escaping FetchFunction,
    context: SessionTransactionContext,
    environment: ManagedSessionExecutionEnvironment
) async throws -> NhostRawResponse {
    if operation.operationID == "signOut" {
        return try await executeSignOut(
            request,
            operation: operation,
            next: next,
            context: context
        )
    }

    let current = try await currentSession(
        context: context,
        refresher: environment.refresher,
        marginSeconds: environment.marginSeconds
    )
    let prepared = attachAuthorization(to: request, session: current, replacingExisting: true)
    let response = try await sendExpectedRequest(prepared, operation: operation, next: next)
    if response.isSuccess {
        try await clearAfterRemoteSuccess(context: context, operation: operation.operationID)
    }
    try Task.checkCancellation()
    return response
}

private func executeSignOut(
    _ request: NhostRequest,
    operation: ManagedAuthOperationAudit,
    next: @escaping FetchFunction,
    context: SessionTransactionContext
) async throws -> NhostRawResponse {
    guard let current = try await context.get() else {
        throw ManagedSessionError.noSession(operation: operation.operationID)
    }

    let signOutRequest: AuthSignOutRequest
    do {
        guard let body = request.body else {
            throw ManagedSessionError.invalidRequestBody(operation: operation.operationID)
        }
        signOutRequest = try NhostJSON.restDecoder.decode(AuthSignOutRequest.self, from: body)
    } catch let error as ManagedSessionError {
        throw error
    } catch {
        throw ManagedSessionError.invalidRequestBody(operation: operation.operationID)
    }

    let refreshToken: String?
    if signOutRequest.refreshToken == nil, signOutRequest.all == true {
        refreshToken = nil
    } else {
        refreshToken = current.refreshToken
    }

    var prepared = request
    prepared.body = try NhostJSON.restEncoder.encode(
        AuthSignOutRequest(refreshToken: refreshToken, all: signOutRequest.all)
    )
    prepared = attachAuthorization(to: prepared, session: current, replacingExisting: true)

    let response = try await sendExpectedRequest(prepared, operation: operation, next: next)
    if response.isSuccess {
        try await clearAfterRemoteSuccess(context: context, operation: operation.operationID)
    }
    try Task.checkCancellation()
    return response
}

private func currentSession(
    context: SessionTransactionContext,
    refresher: SessionRefresher?,
    marginSeconds: Int
) async throws -> StoredSession? {
    if let refresher {
        return try await refresher.refreshSession(in: context, marginSeconds: marginSeconds)
    }
    return try await context.get()
}

private func clearAfterRemoteSuccess(
    context: SessionTransactionContext,
    operation: String
) async throws {
    do {
        try await context.remove()
        return
    } catch {
        do {
            try await context.remove()
            return
        } catch {
            throw ManagedSessionError.localSessionStateUncertain(operation: operation)
        }
    }
}

private func decodePayloadSession(_ body: Data) throws -> StoredSession? {
    let payload: AuthSessionPayload
    do {
        payload = try NhostJSON.restDecoder.decode(AuthSessionPayload.self, from: body)
    } catch {
        throw FetchError.decoding(String(describing: error))
    }
    guard let session = payload.session else { return nil }
    return try StoredSession(session)
}

private func attachAuthorization(
    to request: NhostRequest,
    session: StoredSession?,
    replacingExisting: Bool
) -> NhostRequest {
    guard let session, !session.accessToken.isEmpty else { return request }
    var request = request
    if replacingExisting {
        request.setHeader("Authorization", "Bearer \(session.accessToken)")
    } else {
        NhostHeaderLookup.setHeaderIfAbsent(
            "Authorization",
            "Bearer \(session.accessToken)",
            on: &request
        )
    }
    return request
}

private func sendExpectedRequest(
    _ request: NhostRequest,
    operation: ManagedAuthOperationAudit?,
    next: @escaping FetchFunction
) async throws -> NhostRawResponse {
    let expectation = ManagedAuthRequestExpectation(operation: operation, request: request)
    let response = try await ManagedSessionTaskContext.$requestExpectation.withValue(expectation) {
        try await next(request)
    }
    try expectation.validateCompletion()
    return response
}
