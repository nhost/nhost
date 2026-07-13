import Foundation

public protocol SessionStorageBackend: Sendable {
    func get() async throws -> StoredSession?
    func set(_ value: StoredSession) async throws
    func remove() async throws
}

public actor MemorySessionStorageBackend: SessionStorageBackend {
    private var session: StoredSession?

    public init(session: StoredSession? = nil) {
        self.session = session
    }

    public func get() async throws -> StoredSession? {
        session
    }

    public func set(_ value: StoredSession) async throws {
        session = value
    }

    public func remove() async throws {
        session = nil
    }
}

public struct CustomSessionStorageBackend: SessionStorageBackend {
    private let getHandler: @Sendable () async throws -> StoredSession?
    private let setHandler: @Sendable (StoredSession) async throws -> Void
    private let removeHandler: @Sendable () async throws -> Void

    public init(
        get: @escaping @Sendable () async throws -> StoredSession?,
        set: @escaping @Sendable (StoredSession) async throws -> Void,
        remove: @escaping @Sendable () async throws -> Void
    ) {
        getHandler = get
        setHandler = set
        removeHandler = remove
    }

    public func get() async throws -> StoredSession? {
        try await getHandler()
    }

    public func set(_ value: StoredSession) async throws {
        try await setHandler(value)
    }

    public func remove() async throws {
        try await removeHandler()
    }
}

public typealias SessionChangeCallback = @Sendable (StoredSession?) async -> Void

typealias SessionTransitionCallback = @Sendable (StoredSession?, StoredSession?) async -> Void

/// A backend-consistent authorization view. `mutationGeneration` advances for
/// every successful SDK-mediated set/remove. `authorizationEpoch` advances only
/// when stable protected authorization material changes, including mediated
/// A→B→A transitions.
struct SessionAuthorizationSnapshot: Sendable {
    let session: StoredSession?
    let mutationGeneration: UInt64
    let authorizationEpoch: UInt64
    let stableFingerprint: String
}

public struct SessionStoreSubscription: Sendable {
    private let cancelHandler: @Sendable () async -> Void

    public init(cancel: @escaping @Sendable () async -> Void) {
        cancelHandler = cancel
    }

    public func cancel() async {
        await cancelHandler()
    }
}

/// Concurrency-safe wrapper around a session storage backend.
public actor SessionStore {
    private static let anonymousFingerprint = NhostSHA256.hexadecimalDigest(
        Data("nhost.session.authorization.anonymous.v1".utf8)
    )

    private let backend: any SessionStorageBackend
    private var subscribers: [UUID: SessionChangeCallback] = [:]
    private var transitionSubscribers: [UUID: SessionTransitionCallback] = [:]
    private var mutationGeneration: UInt64 = 0
    private var authorizationEpoch: UInt64 = 0
    private var consistencyRevision: UInt64 = 0
    private var mutationsInFlight = 0
    private var hasObservedAuthorization = false
    private var observedSession: StoredSession?
    private var observedFingerprint = anonymousFingerprint

    public init(storage: any SessionStorageBackend = defaultSessionStorageBackend()) {
        backend = storage
    }

    public func get() async throws -> StoredSession? {
        try await backend.get()
    }

    @discardableResult
    public func set(_ session: AuthSession) async throws -> StoredSession {
        let stored = try StoredSession(session)
        return try await set(stored)
    }

    @discardableResult
    public func set(_ session: StoredSession) async throws -> StoredSession {
        beginMutation()
        let backendOldSession = try? await backend.get()

        do {
            try await backend.set(session)
            mutationGeneration &+= 1
            let oldSession = prepareObservedBaseline(backendOldSession)
            updateObservedAuthorization(session)
            finishMutation()
            await notifyTransitionSubscribers(old: oldSession, new: session)
            await notifySubscribers(session)
            return session
        } catch {
            finishMutation()
            throw error
        }
    }

    public func remove() async throws {
        beginMutation()
        let backendOldSession = try? await backend.get()

        do {
            try await backend.remove()
            mutationGeneration &+= 1
            let oldSession = prepareObservedBaseline(backendOldSession)
            updateObservedAuthorization(nil)
            finishMutation()
            await notifyTransitionSubscribers(old: oldSession, new: nil)
            await notifySubscribers(nil)
        } catch {
            finishMutation()
            throw error
        }
    }

    public func subscribe(_ callback: @escaping SessionChangeCallback) -> SessionStoreSubscription {
        let id = UUID()
        subscribers[id] = callback

        return SessionStoreSubscription {
            await self.unsubscribe(id)
        }
    }

    /// Resolves a snapshot by re-reading the backend. The consistency revision
    /// prevents actor reentrancy from returning a value observed during an SDK
    /// mutation. A custom backend can still perform an entire A→B→A sequence
    /// between SDK reads; no wrapper can observe that out-of-band ABA transition.
    func authorizationSnapshot() async throws -> SessionAuthorizationSnapshot {
        while true {
            guard mutationsInFlight == 0 else {
                await Task.yield()
                continue
            }

            let revision = consistencyRevision
            let session = try await backend.get()
            guard mutationsInFlight == 0, revision == consistencyRevision else {
                continue
            }

            let previous = observedSession
            let previousFingerprint = observedFingerprint
            let hadObservedAuthorization = hasObservedAuthorization
            if hadObservedAuthorization {
                updateObservedAuthorization(session)
            } else {
                hasObservedAuthorization = true
                observedSession = session
                observedFingerprint = Self.fingerprint(of: session)
            }

            if hadObservedAuthorization, previousFingerprint != observedFingerprint {
                await notifyTransitionSubscribers(old: previous, new: session)
            }

            return SessionAuthorizationSnapshot(
                session: session,
                mutationGeneration: mutationGeneration,
                authorizationEpoch: authorizationEpoch,
                stableFingerprint: observedFingerprint
            )
        }
    }

    func subscribeToTransitions(
        _ callback: @escaping SessionTransitionCallback
    ) -> SessionStoreSubscription {
        let id = UUID()
        transitionSubscribers[id] = callback
        return SessionStoreSubscription {
            await self.unsubscribeTransition(id)
        }
    }

    private func beginMutation() {
        mutationsInFlight += 1
        consistencyRevision &+= 1
    }

    private func finishMutation() {
        mutationsInFlight -= 1
        consistencyRevision &+= 1
    }

    private func prepareObservedBaseline(_ backendSession: StoredSession?) -> StoredSession? {
        if !hasObservedAuthorization {
            hasObservedAuthorization = true
            observedSession = backendSession
            observedFingerprint = Self.fingerprint(of: backendSession)
        }
        return observedSession
    }

    private func updateObservedAuthorization(_ session: StoredSession?) {
        let fingerprint = Self.fingerprint(of: session)
        if hasObservedAuthorization, fingerprint != observedFingerprint {
            authorizationEpoch &+= 1
        }
        hasObservedAuthorization = true
        observedSession = session
        observedFingerprint = fingerprint
    }

    private static func fingerprint(of session: StoredSession?) -> String {
        session?.stableAuthorizationFingerprint ?? anonymousFingerprint
    }

    private func unsubscribe(_ id: UUID) {
        subscribers.removeValue(forKey: id)
    }

    private func unsubscribeTransition(_ id: UUID) {
        transitionSubscribers.removeValue(forKey: id)
    }

    private func notifySubscribers(_ session: StoredSession?) async {
        let callbacks = Array(subscribers.values)
        for callback in callbacks {
            await callback(session)
        }
    }

    private func notifyTransitionSubscribers(old: StoredSession?, new: StoredSession?) async {
        let callbacks = Array(transitionSubscribers.values)
        for callback in callbacks {
            await callback(old, new)
        }
    }
}

/// Default key under which the session is persisted. Matches nhost-js's
/// `DEFAULT_SESSION_KEY`, so custom backends sharing a store with the
/// JavaScript SDK (e.g. server-side cookies) can interoperate.
public let defaultSessionKey = "nhostSession"

public func defaultSessionStorageBackend() -> any SessionStorageBackend {
    #if canImport(Security)
    KeychainSessionStorageBackend()
    #else
    MemorySessionStorageBackend()
    #endif
}
