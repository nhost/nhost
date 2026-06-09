import Foundation

public actor SessionRefresher {
    private let auth: AuthClient
    private let store: SessionStore
    private let now: @Sendable () -> Date
    private var inFlight: Task<StoredSession?, Never>?

    public init(
        auth: AuthClient,
        store: SessionStore,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.auth = auth
        self.store = store
        self.now = now
    }

    /// Refresh the current session when it is missing expiration data, expired, force-refreshed, or within margin.
    ///
    /// `marginSeconds == 0` forces a refresh attempt. Transient failures are retried once for expired sessions;
    /// a 401 while the current token is expired clears storage and returns `nil`.
    public func refreshSession(marginSeconds: Int = 60) async -> StoredSession? {
        let assessment = await Self.assess(store: store, marginSeconds: marginSeconds, now: now)

        guard let session = assessment.session else {
            return nil
        }

        guard assessment.needsRefresh else {
            return session
        }

        if let inFlight {
            return await inFlight.value
        }

        let task = Task { [auth, store, now] in
            await Self.refreshWithRetry(auth: auth, store: store, marginSeconds: marginSeconds, now: now)
        }
        inFlight = task

        let refreshed = await task.value
        inFlight = nil
        return refreshed
    }

    private static func refreshWithRetry(
        auth: AuthClient,
        store: SessionStore,
        marginSeconds: Int,
        now: @escaping @Sendable () -> Date
    ) async -> StoredSession? {
        do {
            return try await refreshOnce(auth: auth, store: store, marginSeconds: marginSeconds, now: now)
        } catch {
            do {
                return try await refreshOnce(auth: auth, store: store, marginSeconds: marginSeconds, now: now)
            } catch {
                let assessment = await assess(store: store, marginSeconds: marginSeconds, now: now)
                if assessment.sessionExpired, statusCode(from: error) == 401 {
                    try? await store.remove()
                }
                return nil
            }
        }
    }

    private static func refreshOnce(
        auth: AuthClient,
        store: SessionStore,
        marginSeconds: Int,
        now: @escaping @Sendable () -> Date
    ) async throws -> StoredSession? {
        let assessment = await assess(store: store, marginSeconds: marginSeconds, now: now)

        guard let session = assessment.session else {
            return nil
        }

        guard assessment.needsRefresh else {
            return session
        }

        do {
            let response = try await auth.refreshToken(body: AuthRefreshTokenRequest(refreshToken: session.refreshToken))
            return try await store.set(response.body)
        } catch {
            if !assessment.sessionExpired {
                return session
            }
            throw error
        }
    }

    private static func assess(
        store: SessionStore,
        marginSeconds: Int,
        now: @Sendable () -> Date
    ) async -> SessionRefreshAssessment {
        guard let session = try? await store.get() else {
            return SessionRefreshAssessment(session: nil, needsRefresh: false, sessionExpired: false)
        }

        guard let expiresAt = session.decodedToken.exp else {
            return SessionRefreshAssessment(session: session, needsRefresh: true, sessionExpired: true)
        }

        let currentTime = now()

        if marginSeconds == 0 {
            return SessionRefreshAssessment(
                session: session,
                needsRefresh: true,
                sessionExpired: expiresAt < currentTime
            )
        }

        let remaining = expiresAt.timeIntervalSince(currentTime)

        if remaining > TimeInterval(marginSeconds) {
            return SessionRefreshAssessment(session: session, needsRefresh: false, sessionExpired: false)
        }

        return SessionRefreshAssessment(
            session: session,
            needsRefresh: true,
            sessionExpired: expiresAt < currentTime
        )
    }

    private static func statusCode(from error: Error) -> Int? {
        if let fetchError = error as? FetchError {
            return fetchError.status
        }

        return nil
    }
}

private struct SessionRefreshAssessment: Sendable {
    let session: StoredSession?
    let needsRefresh: Bool
    let sessionExpired: Bool
}
