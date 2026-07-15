import Foundation

/// Failures specific to rotating a persisted session.
public enum SessionRefreshError: Error, Sendable, Equatable {
    /// Auth rotated the refresh token, but the SDK could not prove that the
    /// rotated session was persisted safely. The caller must reauthenticate.
    case persistenceAfterRotation
}

extension SessionRefreshError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .persistenceAfterRotation:
            "The refresh token was rotated, but the refreshed session could not be persisted safely. Reauthentication is required."
        }
    }
}

typealias SessionRefreshSleeper = @Sendable (TimeInterval) async throws -> Void

/// Coordinates refresh-token rotation with the session store transaction.
public actor SessionRefresher {
    private let auth: AuthClient
    private let store: SessionStore
    private let now: @Sendable () -> Date
    private let sleeper: SessionRefreshSleeper

    public init(
        auth: AuthClient,
        store: SessionStore,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.auth = auth
        self.store = store
        self.now = now
        sleeper = SessionRefreshPolicy.defaultSleep
    }

    init(
        auth: AuthClient,
        store: SessionStore,
        now: @escaping @Sendable () -> Date,
        sleeper: @escaping SessionRefreshSleeper
    ) {
        self.auth = auth
        self.store = store
        self.now = now
        self.sleeper = sleeper
    }

    /// Refreshes the current session when it is expired, lacks expiration data,
    /// is within `marginSeconds`, or when the margin is zero (forced refresh).
    ///
    /// `nil` means that storage contains no session. Coordination, storage,
    /// cancellation, non-transient Auth, and expired-session refresh failures
    /// throw. After its single retry budget is exhausted, a transient refresh
    /// failure may return the current session only while its access token is
    /// still unexpired.
    public func refreshSession(marginSeconds: Int = 60) async throws -> StoredSession? {
        let current = try await store.get()
        let assessment = Self.assess(
            session: current,
            marginSeconds: marginSeconds,
            now: now
        )

        guard assessment.needsRefresh else {
            return assessment.session
        }

        let environment = SessionRefreshEnvironment(
            auth: auth,
            marginSeconds: marginSeconds,
            now: now,
            sleeper: sleeper,
            retryBudget: SessionRefreshRetryBudget()
        )

        return try await store.withTransaction { context in
            let lockedSession = try await context.get()
            let lockedAssessment = Self.assess(
                session: lockedSession,
                marginSeconds: environment.marginSeconds,
                now: environment.now
            )

            guard let session = lockedAssessment.session else {
                return nil
            }
            guard lockedAssessment.needsRefresh else {
                return session
            }

            return try await Self.refresh(
                session: session,
                assessment: lockedAssessment,
                context: context,
                environment: environment,
                mayRefreshReplacement: true
            )
        }
    }

    private static func refresh(
        session: StoredSession,
        assessment: SessionRefreshAssessment,
        context: SessionTransactionContext,
        environment: SessionRefreshEnvironment,
        mayRefreshReplacement: Bool
    ) async throws -> StoredSession? {
        let consumedIdentity = SessionRefreshTokenIdentity(session)
        let response: AuthSession

        do {
            response = try await requestRefresh(
                token: session.refreshToken,
                environment: environment
            )
        } catch {
            if SessionRefreshPolicy.isCancellation(error) || Task.isCancelled {
                throw CancellationError()
            }

            if SessionRefreshPolicy.isInvalidRefreshToken(error) {
                return try await handleInvalidRefreshToken(
                    error: error,
                    rejectedIdentity: consumedIdentity,
                    context: context,
                    environment: environment,
                    mayRefreshReplacement: mayRefreshReplacement
                )
            }

            if SessionRefreshPolicy.isTransient(error), !assessment.sessionExpired {
                return session
            }
            throw error
        }

        let rotatedSession: StoredSession
        do {
            rotatedSession = try StoredSession(response)
        } catch {
            // The server has consumed the old token even if its success payload
            // cannot be represented locally. Avoid leaving that exact token as a
            // misleading usable credential.
            _ = try? await context.remove(ifRefreshTokenMatches: consumedIdentity)
            throw SessionRefreshError.persistenceAfterRotation
        }

        let persisted = try await persistAfterRotation(
            rotatedSession,
            consumedIdentity: consumedIdentity,
            context: context
        )

        // A transport is allowed to ignore cancellation. Persist a successful
        // rotation first, but do not report the cancelled operation as success.
        try Task.checkCancellation()
        return persisted
    }

    private static func requestRefresh(
        token: String,
        environment: SessionRefreshEnvironment
    ) async throws -> AuthSession {
        while true {
            try Task.checkCancellation()
            do {
                return try await environment.auth.refreshToken(
                    body: AuthRefreshTokenRequest(refreshToken: token)
                ).body
            } catch {
                if SessionRefreshPolicy.isCancellation(error) || Task.isCancelled {
                    throw CancellationError()
                }

                guard let delay = SessionRefreshPolicy.retryDelay(for: error, now: environment.now),
                      environment.retryBudget.consume()
                else {
                    throw error
                }

                if delay > 0 {
                    try await environment.sleeper(delay)
                }
            }
        }
    }

    private static func handleInvalidRefreshToken(
        error: any Error,
        rejectedIdentity: SessionRefreshTokenIdentity,
        context: SessionTransactionContext,
        environment: SessionRefreshEnvironment,
        mayRefreshReplacement: Bool
    ) async throws -> StoredSession? {
        while true {
            guard let current = try await context.get() else {
                return nil
            }

            if SessionRefreshTokenIdentity(current) == rejectedIdentity {
                if try await context.remove(ifRefreshTokenMatches: rejectedIdentity) {
                    throw error
                }
                // Storage changed between the read and conditional remove.
                // Re-read and assess the replacement without leaving ownership.
                continue
            }

            let replacementAssessment = assess(
                session: current,
                marginSeconds: environment.marginSeconds,
                now: environment.now
            )
            guard replacementAssessment.needsRefresh else {
                return current
            }

            guard mayRefreshReplacement else {
                if !replacementAssessment.sessionExpired {
                    return current
                }
                throw error
            }

            return try await refresh(
                session: current,
                assessment: replacementAssessment,
                context: context,
                environment: environment,
                mayRefreshReplacement: false
            )
        }
    }

    private static func persistAfterRotation(
        _ rotated: StoredSession,
        consumedIdentity: SessionRefreshTokenIdentity,
        context: SessionTransactionContext
    ) async throws -> StoredSession {
        do {
            if try await context.set(rotated, ifRefreshTokenMatches: consumedIdentity) {
                return rotated
            }
        } catch {
            // A throwing backend write may nevertheless have committed.
        }

        let firstRead: StoredSession?
        do {
            firstRead = try await context.get()
        } catch {
            // With an unreadable backend there is no safe basis for retrying a
            // write or clearing a credential.
            throw SessionRefreshError.persistenceAfterRotation
        }
        if let firstRead {
            if provesPersistence(firstRead, of: rotated) {
                return firstRead
            }
            guard SessionRefreshTokenIdentity(firstRead) == consumedIdentity else {
                // Another writer installed a replacement; never overwrite it.
                throw SessionRefreshError.persistenceAfterRotation
            }
        }

        do {
            if try await context.set(rotated, ifRefreshTokenMatches: consumedIdentity) {
                return rotated
            }
        } catch {
            // Re-read below to distinguish ambiguous success from failure.
        }

        let finalRead: StoredSession?
        do {
            finalRead = try await context.get()
        } catch {
            throw SessionRefreshError.persistenceAfterRotation
        }
        if let finalRead {
            if provesPersistence(finalRead, of: rotated) {
                return finalRead
            }
            if SessionRefreshTokenIdentity(finalRead) == consumedIdentity {
                _ = try? await context.remove(ifRefreshTokenMatches: consumedIdentity)
            }
        }
        // An absent value or a replacement is already safe from destructive action.
        throw SessionRefreshError.persistenceAfterRotation
    }

    private static func provesPersistence(_ stored: StoredSession, of rotated: StoredSession) -> Bool {
        SessionRefreshTokenIdentity(stored) == SessionRefreshTokenIdentity(rotated)
    }

    private static func assess(
        session: StoredSession?,
        marginSeconds: Int,
        now: @Sendable () -> Date
    ) -> SessionRefreshAssessment {
        guard let session else {
            return SessionRefreshAssessment(session: nil, needsRefresh: false, sessionExpired: false)
        }

        guard let expiresAt = session.decodedToken.exp else {
            return SessionRefreshAssessment(session: session, needsRefresh: true, sessionExpired: true)
        }

        let currentTime = now()
        let expired = expiresAt <= currentTime
        if marginSeconds == 0 {
            return SessionRefreshAssessment(session: session, needsRefresh: true, sessionExpired: expired)
        }

        let remaining = expiresAt.timeIntervalSince(currentTime)
        return SessionRefreshAssessment(
            session: session,
            needsRefresh: remaining <= TimeInterval(max(marginSeconds, 0)),
            sessionExpired: expired
        )
    }

}

private struct SessionRefreshEnvironment: Sendable {
    let auth: AuthClient
    let marginSeconds: Int
    let now: @Sendable () -> Date
    let sleeper: SessionRefreshSleeper
    let retryBudget: SessionRefreshRetryBudget
}

private final class SessionRefreshRetryBudget: @unchecked Sendable {
    private let lock = NSLock()
    private var isAvailable = true

    func consume() -> Bool {
        lock.withLock {
            guard isAvailable else { return false }
            isAvailable = false
            return true
        }
    }
}

private struct SessionRefreshAssessment: Sendable {
    let session: StoredSession?
    let needsRefresh: Bool
    let sessionExpired: Bool
}
