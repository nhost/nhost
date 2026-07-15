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
typealias SessionTransitionObserver = @Sendable (StoredSession?, StoredSession?) -> Void

enum SessionStoreTransactionError: Error, Equatable, Sendable {
    case expiredLease
}

/// Exact rotating-token identity. Stable authorization fingerprints deliberately
/// omit these values and must not be used for conditional credential mutation.
struct SessionRefreshTokenIdentity: Equatable, Sendable {
    let id: String
    let token: String

    init(_ session: StoredSession) {
        id = session.refreshTokenId
        token = session.refreshToken
    }
}

private final class SessionTransitionSubscribers: @unchecked Sendable {
    struct DeliveryPlan: Sendable {
        let callbackIDs: [UUID]
        let observerIDs: [UUID]
        let publicCallbackIDs: [UUID]
    }

    private let lock = NSLock()
    private var callbacks: [UUID: SessionTransitionCallback] = [:]
    private var callbackOrder: [UUID] = []
    private var observers: [UUID: SessionTransitionObserver] = [:]
    private var observerOrder: [UUID] = []
    private var publicCallbacks: [UUID: SessionChangeCallback] = [:]
    private var publicCallbackOrder: [UUID] = []

    func subscribe(_ callback: @escaping SessionTransitionCallback) -> SessionStoreSubscription {
        let id = UUID()
        lock.withLock {
            callbacks[id] = callback
            callbackOrder.append(id)
        }
        return subscription(id: id, kind: .transition)
    }

    func observe(_ observer: @escaping SessionTransitionObserver) -> SessionStoreSubscription {
        let id = UUID()
        lock.withLock {
            observers[id] = observer
            observerOrder.append(id)
        }
        return subscription(id: id, kind: .observer)
    }

    func subscribeToChanges(_ callback: @escaping SessionChangeCallback) -> SessionStoreSubscription {
        let id = UUID()
        lock.withLock {
            publicCallbacks[id] = callback
            publicCallbackOrder.append(id)
        }
        return subscription(id: id, kind: .publicChange)
    }

    func deliveryPlan(includePublicCallbacks: Bool) -> DeliveryPlan {
        lock.withLock {
            DeliveryPlan(
                callbackIDs: callbackOrder,
                observerIDs: observerOrder,
                publicCallbackIDs: includePublicCallbacks ? publicCallbackOrder : []
            )
        }
    }

    func callback(for id: UUID) -> SessionTransitionCallback? {
        lock.withLock { callbacks[id] }
    }

    func observer(for id: UUID) -> SessionTransitionObserver? {
        lock.withLock { observers[id] }
    }

    func publicCallback(for id: UUID) -> SessionChangeCallback? {
        lock.withLock { publicCallbacks[id] }
    }

    private enum SubscriptionKind {
        case transition
        case observer
        case publicChange
    }

    private func subscription(id: UUID, kind: SubscriptionKind) -> SessionStoreSubscription {
        SessionStoreSubscription(cancelImmediately: { [weak self] in
            self?.remove(id, kind: kind)
        })
    }

    private func remove(_ id: UUID, kind: SubscriptionKind) {
        lock.withLock {
            switch kind {
            case .transition:
                callbacks.removeValue(forKey: id)
                callbackOrder.removeAll { $0 == id }
            case .observer:
                observers.removeValue(forKey: id)
                observerOrder.removeAll { $0 == id }
            case .publicChange:
                publicCallbacks.removeValue(forKey: id)
                publicCallbackOrder.removeAll { $0 == id }
            }
        }
    }
}

private struct SessionNotification: Sendable {
    let sequence: UInt64
    let oldSession: StoredSession?
    let newSession: StoredSession?
    let deliveryPlan: SessionTransitionSubscribers.DeliveryPlan
}

/// Buffers post-lease enqueue races and starts callbacks in transition-sequence
/// order. Enqueue never waits for callback completion, so callbacks may mutate
/// the same store without deadlocking.
private actor SessionNotificationQueue {
    private let subscribers: SessionTransitionSubscribers
    private var pending: [UInt64: SessionNotification] = [:]
    private var nextSequence: UInt64 = 1
    private var isDraining = false

    init(subscribers: SessionTransitionSubscribers) {
        self.subscribers = subscribers
    }

    func enqueue(_ notification: SessionNotification) {
        pending[notification.sequence] = notification
        guard !isDraining else { return }
        isDraining = true
        Task { await drainReadyNotifications() }
    }

    private func drainReadyNotifications() async {
        while let notification = pending.removeValue(forKey: nextSequence) {
            nextSequence &+= 1
            deliverObservers(notification)
            await deliverTransitionCallbacks(notification)
            await deliverPublicCallbacks(notification)
        }
        isDraining = false
    }

    private func deliverObservers(_ notification: SessionNotification) {
        for id in notification.deliveryPlan.observerIDs {
            subscribers.observer(for: id)?(notification.oldSession, notification.newSession)
        }
    }

    private func deliverTransitionCallbacks(_ notification: SessionNotification) async {
        for id in notification.deliveryPlan.callbackIDs {
            guard let callback = subscribers.callback(for: id) else { continue }
            await callback(notification.oldSession, notification.newSession)
        }
    }

    private func deliverPublicCallbacks(_ notification: SessionNotification) async {
        for id in notification.deliveryPlan.publicCallbackIDs {
            guard let callback = subscribers.publicCallback(for: id) else { continue }
            await callback(notification.newSession)
        }
    }
}

private final class SessionTransactionLease: @unchecked Sendable {
    private let lock = NSLock()
    private var isActive = true
    private var activeOperations = 0
    private var expirationWaiters: [CheckedContinuation<Void, Never>] = []
    private var notifications: [SessionNotification] = []

    func beginOperation() throws {
        try lock.withLock {
            guard isActive else { throw SessionStoreTransactionError.expiredLease }
            activeOperations += 1
        }
    }

    func finishOperation() {
        let waiters: [CheckedContinuation<Void, Never>] = lock.withLock {
            activeOperations -= 1
            guard !isActive, activeOperations == 0 else { return [] }
            defer { expirationWaiters.removeAll() }
            return expirationWaiters
        }
        for waiter in waiters {
            waiter.resume()
        }
    }

    func record(_ notification: SessionNotification) {
        lock.withLock { notifications.append(notification) }
    }

    func expireAndWait() async {
        await withCheckedContinuation { continuation in
            let shouldResume = lock.withLock {
                isActive = false
                guard activeOperations > 0 else { return true }
                expirationWaiters.append(continuation)
                return false
            }
            if shouldResume {
                continuation.resume()
            }
        }
    }

    func recordedNotifications() -> [SessionNotification] {
        lock.withLock { notifications }
    }
}

/// Lease-bound backend access for one coordinated transaction. Operations use
/// the backend directly and never reacquire coordination. A retained context
/// fails with `expiredLease` after its transaction structurally exits.
struct SessionTransactionContext: Sendable {
    private let lease: SessionTransactionLease
    private let backend: any SessionStorageBackend
    private let setHandler: @Sendable (
        StoredSession,
        SessionRefreshTokenIdentity?
    ) async throws -> Bool
    private let removeHandler: @Sendable (SessionRefreshTokenIdentity?) async throws -> Bool

    fileprivate init(
        lease: SessionTransactionLease,
        backend: any SessionStorageBackend,
        set: @escaping @Sendable (
            StoredSession,
            SessionRefreshTokenIdentity?
        ) async throws -> Bool,
        remove: @escaping @Sendable (SessionRefreshTokenIdentity?) async throws -> Bool
    ) {
        self.lease = lease
        self.backend = backend
        setHandler = set
        removeHandler = remove
    }

    func get() async throws -> StoredSession? {
        try lease.beginOperation()
        defer { lease.finishOperation() }
        return try await backend.get()
    }

    @discardableResult
    func set(_ session: StoredSession) async throws -> StoredSession {
        try lease.beginOperation()
        defer { lease.finishOperation() }
        _ = try await setHandler(session, nil)
        return session
    }

    func set(
        _ session: StoredSession,
        ifRefreshTokenMatches identity: SessionRefreshTokenIdentity
    ) async throws -> Bool {
        try lease.beginOperation()
        defer { lease.finishOperation() }
        return try await setHandler(session, identity)
    }

    func remove() async throws {
        try lease.beginOperation()
        defer { lease.finishOperation() }
        _ = try await removeHandler(nil)
    }

    func remove(ifRefreshTokenMatches identity: SessionRefreshTokenIdentity) async throws -> Bool {
        try lease.beginOperation()
        defer { lease.finishOperation() }
        return try await removeHandler(identity)
    }
}

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
    private let immediateCancelHandler: (@Sendable () -> Void)?

    public init(cancel: @escaping @Sendable () async -> Void) {
        cancelHandler = cancel
        immediateCancelHandler = nil
    }

    init(cancelImmediately: @escaping @Sendable () -> Void) {
        cancelHandler = cancelImmediately
        immediateCancelHandler = cancelImmediately
    }

    public func cancel() async {
        await cancelHandler()
    }

    func cancelImmediately() {
        immediateCancelHandler?()
    }
}

private struct SessionCommitResult: Sendable {
    let didCommit: Bool
    let notification: SessionNotification?
}

/// Concurrency-safe wrapper around a session storage backend.
public actor SessionStore {
    private static let anonymousFingerprint = NhostSHA256.hexadecimalDigest(
        Data("nhost.session.authorization.anonymous.v1".utf8)
    )

    private let backend: any SessionStorageBackend
    private let coordinator: any SessionCoordinator
    private nonisolated let transitionSubscribers: SessionTransitionSubscribers
    private nonisolated let notificationQueue: SessionNotificationQueue
    private let beforeNotificationEnqueue: @Sendable (UInt64) async -> Void
    private var mutationGeneration: UInt64 = 0
    private var authorizationEpoch: UInt64 = 0
    private var consistencyRevision: UInt64 = 0
    private var mutationsInFlight = 0
    private var mutationWaiters: [CheckedContinuation<Void, Never>] = []
    private var hasObservedAuthorization = false
    private var observedSession: StoredSession?
    private var observedFingerprint = anonymousFingerprint
    private var transitionSequence: UInt64 = 0

    public init(storage: any SessionStorageBackend = defaultSessionStorageBackend()) {
        let subscribers = SessionTransitionSubscribers()
        backend = storage
        coordinator = ProcessLocalSessionCoordinator()
        transitionSubscribers = subscribers
        notificationQueue = SessionNotificationQueue(subscribers: subscribers)
        beforeNotificationEnqueue = { _ in }
    }

    init(
        storage: any SessionStorageBackend,
        coordinator: any SessionCoordinator,
        beforeNotificationEnqueue: @escaping @Sendable (UInt64) async -> Void = { _ in }
    ) {
        let subscribers = SessionTransitionSubscribers()
        backend = storage
        self.coordinator = coordinator
        transitionSubscribers = subscribers
        notificationQueue = SessionNotificationQueue(subscribers: subscribers)
        self.beforeNotificationEnqueue = beforeNotificationEnqueue
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
        try await withTransaction { context in
            try await context.set(session)
        }
    }

    public func remove() async throws {
        try await withTransaction { context in
            try await context.remove()
        }
    }

    /// Runs a coordinated session operation. The context performs backend work
    /// without acquiring again and is invalid as soon as this closure exits.
    func withTransaction<Result: Sendable>(
        _ operation: @Sendable (SessionTransactionContext) async throws -> Result
    ) async throws -> Result {
        let lease = SessionTransactionLease()
        let context = SessionTransactionContext(
            lease: lease,
            backend: backend,
            set: { [weak self, lease] session, expectedIdentity in
                guard let self else { throw CancellationError() }
                let result = try await self.commitSet(session, expectedIdentity: expectedIdentity)
                if let notification = result.notification {
                    lease.record(notification)
                }
                return result.didCommit
            },
            remove: { [weak self, lease] expectedIdentity in
                guard let self else { throw CancellationError() }
                let result = try await self.commitRemove(expectedIdentity: expectedIdentity)
                if let notification = result.notification {
                    lease.record(notification)
                }
                return result.didCommit
            }
        )

        do {
            let value = try await coordinator.withCoordination {
                do {
                    let value = try await operation(context)
                    await lease.expireAndWait()
                    return value
                } catch {
                    await lease.expireAndWait()
                    throw error
                }
            }
            await enqueueRecordedNotifications(from: lease)
            return value
        } catch {
            await lease.expireAndWait()
            await enqueueRecordedNotifications(from: lease)
            throw error
        }
    }

    /// Observes SDK-mediated mutations on this store. Delivery is FIFO for this
    /// store only and begins after coordination is released; mutations return
    /// once delivery is enqueued, not after callbacks finish. Cancellation skips
    /// callbacks whose delivery has not started. Other stores and processes do
    /// not push changes here and are discovered by a later backend reread.
    public nonisolated func subscribe(
        _ callback: @escaping SessionChangeCallback
    ) -> SessionStoreSubscription {
        transitionSubscribers.subscribeToChanges(callback)
    }

    /// Resolves a snapshot by re-reading the backend. Snapshot reads remain
    /// available while a transaction owns coordination for network work and
    /// wait only for the backend's brief commit window.
    func authorizationSnapshot() async throws -> SessionAuthorizationSnapshot {
        while true {
            await waitForMutationCommit()
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
                let notification = makeNotification(
                    old: previous,
                    new: session,
                    includePublicCallbacks: false
                )
                await notificationQueue.enqueue(notification)
            }

            return SessionAuthorizationSnapshot(
                session: session,
                mutationGeneration: mutationGeneration,
                authorizationEpoch: authorizationEpoch,
                stableFingerprint: observedFingerprint
            )
        }
    }

    nonisolated func subscribeToTransitions(
        _ callback: @escaping SessionTransitionCallback
    ) -> SessionStoreSubscription {
        transitionSubscribers.subscribe(callback)
    }

    nonisolated func observeTransitions(
        _ observer: @escaping SessionTransitionObserver
    ) -> SessionStoreSubscription {
        transitionSubscribers.observe(observer)
    }

    private func commitSet(
        _ session: StoredSession,
        expectedIdentity: SessionRefreshTokenIdentity?
    ) async throws -> SessionCommitResult {
        beginMutation()
        defer { finishMutation() }

        let backendOldSession: StoredSession?
        if expectedIdentity == nil {
            backendOldSession = try? await backend.get()
        } else {
            backendOldSession = try await backend.get()
        }
        if let expectedIdentity,
           backendOldSession.map(SessionRefreshTokenIdentity.init) != expectedIdentity {
            return SessionCommitResult(didCommit: false, notification: nil)
        }

        try await backend.set(session)
        mutationGeneration &+= 1
        let oldSession = prepareObservedBaseline(backendOldSession)
        updateObservedAuthorization(session)
        return SessionCommitResult(
            didCommit: true,
            notification: makeNotification(
                old: oldSession,
                new: session,
                includePublicCallbacks: true
            )
        )
    }

    private func commitRemove(
        expectedIdentity: SessionRefreshTokenIdentity?
    ) async throws -> SessionCommitResult {
        beginMutation()
        defer { finishMutation() }

        let backendOldSession: StoredSession?
        if expectedIdentity == nil {
            backendOldSession = try? await backend.get()
        } else {
            backendOldSession = try await backend.get()
        }
        if let expectedIdentity,
           backendOldSession.map(SessionRefreshTokenIdentity.init) != expectedIdentity {
            return SessionCommitResult(didCommit: false, notification: nil)
        }

        try await backend.remove()
        mutationGeneration &+= 1
        let oldSession = prepareObservedBaseline(backendOldSession)
        updateObservedAuthorization(nil)
        return SessionCommitResult(
            didCommit: true,
            notification: makeNotification(
                old: oldSession,
                new: nil,
                includePublicCallbacks: true
            )
        )
    }

    private func beginMutation() {
        mutationsInFlight += 1
        consistencyRevision &+= 1
    }

    private func finishMutation() {
        mutationsInFlight -= 1
        consistencyRevision &+= 1
        guard mutationsInFlight == 0 else { return }
        let waiters = mutationWaiters
        mutationWaiters.removeAll()
        for waiter in waiters {
            waiter.resume()
        }
    }

    private func waitForMutationCommit() async {
        guard mutationsInFlight > 0 else { return }
        await withCheckedContinuation { continuation in
            mutationWaiters.append(continuation)
        }
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

    private func makeNotification(
        old: StoredSession?,
        new: StoredSession?,
        includePublicCallbacks: Bool
    ) -> SessionNotification {
        transitionSequence &+= 1
        return SessionNotification(
            sequence: transitionSequence,
            oldSession: old,
            newSession: new,
            deliveryPlan: transitionSubscribers.deliveryPlan(
                includePublicCallbacks: includePublicCallbacks
            )
        )
    }

    private func enqueueRecordedNotifications(from lease: SessionTransactionLease) async {
        for notification in lease.recordedNotifications() {
            await beforeNotificationEnqueue(notification.sequence)
            await notificationQueue.enqueue(notification)
        }
    }

    private static func fingerprint(of session: StoredSession?) -> String {
        session?.stableAuthorizationFingerprint ?? anonymousFingerprint
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
