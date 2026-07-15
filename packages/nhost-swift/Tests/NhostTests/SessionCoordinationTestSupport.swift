import Foundation
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif
@testable import Nhost

actor CoordinationSignal {
    private var isSignaled = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func wait() async {
        if isSignaled { return }
        await withCheckedContinuation { continuation in
            waiters.append(continuation)
        }
    }

    func signal() {
        guard !isSignaled else { return }
        isSignaled = true
        let continuations = waiters
        waiters.removeAll()
        for continuation in continuations {
            continuation.resume()
        }
    }
}

actor CoordinationRecorder {
    private var values: [Int] = []
    private var active = 0
    private var maximumActive = 0

    func enter(_ value: Int) {
        values.append(value)
        active += 1
        maximumActive = max(maximumActive, active)
    }

    func leave() {
        active -= 1
    }

    func snapshot() -> (values: [Int], maximumActive: Int) {
        (values, maximumActive)
    }
}

struct TestOperationError: Error, Equatable {}

final class CoordinationSleepRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var intervals: [TimeInterval] = []

    func record(_ interval: TimeInterval) {
        lock.withLock { intervals.append(interval) }
    }

    func snapshot() -> [TimeInterval] {
        lock.withLock { intervals }
    }
}

final class FakeFileLockSystem: @unchecked Sendable {
    struct FlockResult {
        let result: Int32
        let error: Int32
    }

    struct Snapshot {
        let openFlags: Int32?
        let openMode: mode_t?
        let changedMode: mode_t?
        let flockOperations: [Int32]
        let closeCount: Int
    }

    private let lock = NSLock()
    private var flockResults: [FlockResult]
    private var currentError: Int32 = 0
    private(set) var openFlags: Int32?
    private(set) var openMode: mode_t?
    private(set) var changedMode: mode_t?
    private(set) var flockOperations: [Int32] = []
    private(set) var closeCount = 0

    init(flockResults: [FlockResult]) {
        self.flockResults = flockResults
    }

    var system: SessionFileLockSystem {
        SessionFileLockSystem(
            openFile: { [self] _, flags, mode in
                lock.withLock {
                    openFlags = flags
                    openMode = mode
                }
                return 42
            },
            changeMode: { [self] _, mode in
                lock.withLock { changedMode = mode }
                return 0
            },
            flockFile: { [self] _, operation in
                lock.withLock {
                    flockOperations.append(operation)
                    if operation == LOCK_UN {
                        currentError = 0
                        return 0
                    }
                    let next = flockResults.isEmpty
                        ? FlockResult(result: 0, error: 0)
                        : flockResults.removeFirst()
                    currentError = next.error
                    return next.result
                }
            },
            closeFile: { [self] _ in
                lock.withLock { closeCount += 1 }
                return 0
            },
            errorCode: { [self] in
                lock.withLock { currentError }
            }
        )
    }

    func snapshot() -> Snapshot {
        lock.withLock {
            Snapshot(
                openFlags: openFlags,
                openMode: openMode,
                changedMode: changedMode,
                flockOperations: flockOperations,
                closeCount: closeCount
            )
        }
    }
}
