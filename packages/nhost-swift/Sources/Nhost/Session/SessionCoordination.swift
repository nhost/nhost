import Foundation
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif
/// Failures raised before a coordinated session operation starts.
enum SessionCoordinationError: Error, Equatable, Sendable {
    case timedOut
    case reentrantAcquisition
    case systemCallFailed(operation: String, code: Int32)
    case appGroupContainerUnavailable(String)
}
/// Serializes a session operation. Implementations must retain ownership until
/// the operation has structurally returned or thrown.
protocol SessionCoordinator: Sendable {
    func withCoordination<Result: Sendable>(
        _ operation: @escaping @Sendable () async throws -> Result
    ) async throws -> Result
}
struct SessionCoordinationDeadline: Sendable {
    let remaining: @Sendable () -> TimeInterval

    var hasElapsed: Bool { remaining() <= 0 }

    func sleepUntilElapsed() async throws {
        while true {
            let delay = remaining()
            guard delay > 0 else { return }
            try await defaultSessionCoordinationSleep(delay)
        }
    }

    static func after(_ timeout: TimeInterval) -> SessionCoordinationDeadline {
        if #available(macOS 13.0, iOS 16.0, tvOS 16.0, watchOS 9.0, *) {
            return continuous(after: timeout)
        }

        let boundedTimeout = max(timeout, 0)
        let start = DispatchTime.now().uptimeNanoseconds
        let timeoutNanoseconds = UInt64(min(boundedTimeout * 1_000_000_000, Double(UInt64.max - start)))
        let deadline = start + timeoutNanoseconds
        return SessionCoordinationDeadline {
            let now = DispatchTime.now().uptimeNanoseconds
            guard now < deadline else { return 0 }
            return TimeInterval(deadline - now) / 1_000_000_000
        }
    }

    @available(macOS 13.0, iOS 16.0, tvOS 16.0, watchOS 9.0, *)
    private static func continuous(after timeout: TimeInterval) -> SessionCoordinationDeadline {
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: .seconds(max(timeout, 0)))
        return SessionCoordinationDeadline {
            let duration = clock.now.duration(to: deadline)
            let components = duration.components
            return max(
                TimeInterval(components.seconds)
                    + TimeInterval(components.attoseconds) / 1_000_000_000_000_000_000,
                0
            )
        }
    }
}
private func defaultSessionCoordinationSleep(_ interval: TimeInterval) async throws {
    let boundedInterval = max(interval, 0)
    if #available(macOS 13.0, iOS 16.0, tvOS 16.0, watchOS 9.0, *) {
        try await ContinuousClock().sleep(for: .seconds(boundedInterval))
    } else {
        let nanoseconds = UInt64(min(boundedInterval * 1_000_000_000, Double(UInt64.max)))
        try await Task.sleep(nanoseconds: nanoseconds)
    }
}
/// A FIFO mutex whose cancellation linearization point is ownership grant.
/// Cancellation removes a queued waiter, but cannot revoke an already-granted
/// lease. Reentry from the same task context fails instead of deadlocking.
final class AsyncSessionMutex: @unchecked Sendable {
    @TaskLocal private static var heldMutexes: Set<UUID> = []

    private struct Waiter {
        let id: UUID
        let continuation: CheckedContinuation<Void, any Error>
    }

    private final class State: @unchecked Sendable {
        private let lock = NSLock()
        private var isOwned = false
        private var waiters: [Waiter] = []
        private var registeredWaiters: Set<UUID> = []
        private var grantedWaiters: Set<UUID> = []
        private var cancelledBeforeEnqueue: [UUID: any Error] = [:]

        func register(id: UUID) {
            _ = lock.withLock { registeredWaiters.insert(id) }
        }

        func enqueue(
            id: UUID,
            alreadyCancelled: Bool,
            deadlineElapsed: Bool,
            continuation: CheckedContinuation<Void, any Error>
        ) {
            let result: Result<Void, any Error>? = lock.withLock {
                registeredWaiters.remove(id)
                if let cancellation = cancelledBeforeEnqueue.removeValue(forKey: id) {
                    return .failure(cancellation)
                }
                if alreadyCancelled {
                    return .failure(CancellationError())
                }
                if !isOwned {
                    isOwned = true
                    grantedWaiters.insert(id)
                    return .success(())
                }
                if deadlineElapsed {
                    return .failure(SessionCoordinationError.timedOut)
                }
                waiters.append(Waiter(id: id, continuation: continuation))
                return nil
            }

            switch result {
            case .success?:
                continuation.resume()
            case let .failure(error)?:
                continuation.resume(throwing: error)
            case nil:
                break
            }
        }

        func cancel(id: UUID, error: any Error) {
            let continuation: CheckedContinuation<Void, any Error>? = lock.withLock {
                if registeredWaiters.remove(id) != nil {
                    cancelledBeforeEnqueue[id] = error
                    return nil
                }
                guard !grantedWaiters.contains(id),
                      let index = waiters.firstIndex(where: { $0.id == id }) else {
                    return nil
                }
                return waiters.remove(at: index).continuation
            }
            continuation?.resume(throwing: error)
        }

        var queuedWaiterCount: Int {
            lock.withLock { waiters.count }
        }

        func release(id: UUID) {
            let continuation: CheckedContinuation<Void, any Error>? = lock.withLock {
                grantedWaiters.remove(id)
                if waiters.isEmpty {
                    isOwned = false
                    return nil
                }
                // Ownership transfers directly, preserving FIFO order.
                let waiter = waiters.removeFirst()
                grantedWaiters.insert(waiter.id)
                return waiter.continuation
            }
            continuation?.resume()
        }
    }

    private let id = UUID()
    private let state = State()

    var queuedWaiterCount: Int { state.queuedWaiterCount }

    func withLock<Result: Sendable>(
        until deadline: SessionCoordinationDeadline? = nil,
        _ operation: @escaping @Sendable () async throws -> Result
    ) async throws -> Result {
        guard !Self.heldMutexes.contains(id) else {
            throw SessionCoordinationError.reentrantAcquisition
        }

        let waiterID = try await acquire(until: deadline)
        defer { state.release(id: waiterID) }

        var held = Self.heldMutexes
        held.insert(id)
        return try await Self.$heldMutexes.withValue(held) {
            try await operation()
        }
    }

    private func acquire(until deadline: SessionCoordinationDeadline?) async throws -> UUID {
        let waiterID = UUID()
        state.register(id: waiterID)
        let timeoutTask: Task<Void, Never>?

        if let deadline {
            timeoutTask = Task { [state] in
                do {
                    try await deadline.sleepUntilElapsed()
                    state.cancel(id: waiterID, error: SessionCoordinationError.timedOut)
                } catch {
                    // The waiter acquired ownership or its parent was cancelled.
                }
            }
        } else {
            timeoutTask = nil
        }
        defer { timeoutTask?.cancel() }

        try await withTaskCancellationHandler {
            let alreadyCancelled = Task.isCancelled
            let deadlineElapsed = deadline?.hasElapsed ?? false
            try await withCheckedThrowingContinuation { continuation in
                state.enqueue(
                    id: waiterID,
                    alreadyCancelled: alreadyCancelled,
                    deadlineElapsed: deadlineElapsed,
                    continuation: continuation
                )
            }
        } onCancel: {
            state.cancel(id: waiterID, error: CancellationError())
        }
        return waiterID
    }
}
/// Process-local coordination used by ordinary, non-shared session stores.
struct ProcessLocalSessionCoordinator: SessionCoordinator {
    private let mutex: AsyncSessionMutex

    init(mutex: AsyncSessionMutex = AsyncSessionMutex()) {
        self.mutex = mutex
    }

    func withCoordination<Result: Sendable>(
        _ operation: @escaping @Sendable () async throws -> Result
    ) async throws -> Result {
        try await mutex.withLock(operation)
    }
}

private final class WeakSessionMutex: @unchecked Sendable {
    weak var value: AsyncSessionMutex?

    init(_ value: AsyncSessionMutex) {
        self.value = value
    }
}

/// `flock` does not provide sufficient same-process exclusion on every
/// supported platform, so all coordinators for one canonical path share this
/// process-local mutex first.
final class SessionMutexRegistry: @unchecked Sendable {
    static let shared = SessionMutexRegistry()

    private let lock = NSLock()
    private var mutexes: [String: WeakSessionMutex] = [:]

    func mutex(forCanonicalPath path: String) -> AsyncSessionMutex {
        lock.withLock {
            if let existing = mutexes[path]?.value {
                return existing
            }

            mutexes = mutexes.filter { $0.value.value != nil }
            let mutex = AsyncSessionMutex()
            mutexes[path] = WeakSessionMutex(mutex)
            return mutex
        }
    }
}

typealias SessionCoordinationSleeper = @Sendable (TimeInterval) async throws -> Void

/// Composes canonical-path process-local ownership with a crash-released file
/// lease. Lock files are opened in place and are never replaced or unlinked.
final class FileSessionCoordinator: SessionCoordinator, @unchecked Sendable {
    /// Polling faster than this is clamped to avoid cooperative-executor spin.
    static let minimumPollInterval: TimeInterval = 0.010

    private let canonicalPath: String
    private let localMutex: AsyncSessionMutex
    private let acquisitionTimeout: TimeInterval
    private let pollInterval: TimeInterval
    private let sleeper: SessionCoordinationSleeper
    private let system: SessionFileLockSystem

    init(
        lockFileURL: URL,
        acquisitionTimeout: TimeInterval,
        pollInterval: TimeInterval = 0.025,
        sleeper: @escaping SessionCoordinationSleeper = { interval in
            try await defaultSessionCoordinationSleep(interval)
        },
        registry: SessionMutexRegistry = .shared,
        system: SessionFileLockSystem = .live
    ) {
        canonicalPath = Self.canonicalPath(for: lockFileURL)
        localMutex = registry.mutex(forCanonicalPath: canonicalPath)
        self.acquisitionTimeout = max(acquisitionTimeout, 0)
        self.pollInterval = max(pollInterval, Self.minimumPollInterval)
        self.sleeper = sleeper
        self.system = system
    }

    func withCoordination<Result: Sendable>(
        _ operation: @escaping @Sendable () async throws -> Result
    ) async throws -> Result {
        let deadline = SessionCoordinationDeadline.after(acquisitionTimeout)
        return try await localMutex.withLock(until: deadline) { [self] in
            try await withFileLock(until: deadline, operation)
        }
    }

    private func withFileLock<Result: Sendable>(
        until deadline: SessionCoordinationDeadline,
        _ operation: @escaping @Sendable () async throws -> Result
    ) async throws -> Result {
        try Task.checkCancellation()
        let descriptor = try openLockFile()
        defer { _ = system.closeFile(descriptor) }

        guard system.changeMode(descriptor, 0o600) == 0 else {
            throw systemError("fchmod")
        }

        try await acquireFileLock(descriptor, until: deadline)
        defer { _ = system.flockFile(descriptor, LOCK_UN) }

        return try await operation()
    }

    private func openLockFile() throws -> Int32 {
        let flags = O_CREAT | O_RDWR | O_CLOEXEC
        while true {
            try Task.checkCancellation()
            let descriptor = system.openFile(canonicalPath, flags, 0o600)
            if descriptor >= 0 {
                return descriptor
            }
            if system.errorCode() != EINTR {
                throw systemError("open")
            }
        }
    }

    private func acquireFileLock(
        _ descriptor: Int32,
        until deadline: SessionCoordinationDeadline
    ) async throws {
        while true {
            try Task.checkCancellation()
            if system.flockFile(descriptor, LOCK_EX | LOCK_NB) == 0 {
                return
            }

            let code = system.errorCode()
            if code == EINTR {
                continue
            }
            guard code == EWOULDBLOCK || code == EAGAIN else {
                throw SessionCoordinationError.systemCallFailed(operation: "flock", code: code)
            }

            let remaining = deadline.remaining()
            guard remaining > 0 else {
                throw SessionCoordinationError.timedOut
            }
            try await sleeper(min(pollInterval, remaining))
        }
    }

    private func systemError(_ operation: String) -> SessionCoordinationError {
        .systemCallFailed(operation: operation, code: system.errorCode())
    }

    private static func canonicalPath(for url: URL) -> String {
        url.standardizedFileURL.resolvingSymlinksInPath().path
    }
}

#if canImport(Darwin)
/// Internal until all managed session mutation paths use coordination. Resolves
/// only the lock-file location; it does not expose shared client configuration.
enum AppGroupSessionLockResolver {
    static func lockFileURL(appGroupIdentifier: String, namespace: String) throws -> URL {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier
        ) else {
            throw SessionCoordinationError.appGroupContainerUnavailable(appGroupIdentifier)
        }

        let digest = NhostSHA256.hexadecimalDigest(Data(namespace.utf8))
        return container.appendingPathComponent(".nhost-session-\(digest).lock", isDirectory: false)
    }
}
#endif
