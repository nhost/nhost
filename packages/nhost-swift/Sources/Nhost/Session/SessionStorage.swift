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
    private let backend: any SessionStorageBackend
    private var subscribers: [UUID: SessionChangeCallback] = [:]

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
        try await backend.set(session)
        await notifySubscribers(session)
        return session
    }

    public func remove() async throws {
        try await backend.remove()
        await notifySubscribers(nil)
    }

    public func subscribe(_ callback: @escaping SessionChangeCallback) -> SessionStoreSubscription {
        let id = UUID()
        subscribers[id] = callback

        return SessionStoreSubscription {
            await self.unsubscribe(id)
        }
    }

    private func unsubscribe(_ id: UUID) {
        subscribers.removeValue(forKey: id)
    }

    private func notifySubscribers(_ session: StoredSession?) async {
        let callbacks = Array(subscribers.values)

        for callback in callbacks {
            await callback(session)
        }
    }
}

public func defaultSessionStorageBackend() -> any SessionStorageBackend {
    #if canImport(Security)
    KeychainSessionStorageBackend()
    #else
    MemorySessionStorageBackend()
    #endif
}
