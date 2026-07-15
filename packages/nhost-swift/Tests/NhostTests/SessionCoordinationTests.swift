import Foundation
import XCTest
#if canImport(Darwin)
import Darwin
#elseif canImport(Glibc)
import Glibc
#endif
@testable import Nhost

final class SessionCoordinationMutexTests: XCTestCase {
    func testMutexIsFIFOAndCancellationRemovesOnlyWaitingAcquisition() async throws {
        let mutex = AsyncSessionMutex()
        let releaseHolder = CoordinationSignal()
        let holderEntered = CoordinationSignal()
        let recorder = CoordinationRecorder()

        let holder = Task {
            try await mutex.withLock {
                await holderEntered.signal()
                await releaseHolder.wait()
            }
        }
        await holderEntered.wait()

        let first = Task {
            try await mutex.withLock {
                await recorder.enter(1)
                await recorder.leave()
            }
        }
        await waitForWaiterCount(1, mutex: mutex)

        let cancelled = Task {
            try await mutex.withLock {
                await recorder.enter(2)
                await recorder.leave()
            }
        }
        await waitForWaiterCount(2, mutex: mutex)

        let third = Task {
            try await mutex.withLock {
                await recorder.enter(3)
                await recorder.leave()
            }
        }
        await waitForWaiterCount(3, mutex: mutex)

        cancelled.cancel()
        await waitForWaiterCount(2, mutex: mutex)
        await releaseHolder.signal()

        try await holder.value
        try await first.value
        do {
            try await cancelled.value
            XCTFail("cancelled waiter unexpectedly acquired ownership")
        } catch is CancellationError {
            // Expected.
        }
        try await third.value

        let snapshot = await recorder.snapshot()
        XCTAssertEqual(snapshot.values, [1, 3])
        XCTAssertEqual(snapshot.maximumActive, 1)
    }

    func testCancellationBeforeAcquisitionNeverRunsOperation() async {
        let mutex = AsyncSessionMutex()
        let operationRan = CoordinationSignal()
        let task = Task {
            try await mutex.withLock {
                await operationRan.signal()
            }
        }
        task.cancel()

        do {
            try await task.value
            XCTFail("pre-cancelled acquisition unexpectedly succeeded")
        } catch is CancellationError {
            // Expected.
        } catch {
            XCTFail("unexpected error: \(error)")
        }
        XCTAssertEqual(mutex.queuedWaiterCount, 0)
    }

    func testNestedSameTaskAcquisitionFailsImmediatelyAndOuterLeaseSurvives() async throws {
        let mutex = AsyncSessionMutex()

        try await mutex.withLock {
            do {
                try await mutex.withLock {}
                XCTFail("nested acquisition unexpectedly succeeded")
            } catch {
                XCTAssertEqual(error as? SessionCoordinationError, .reentrantAcquisition)
            }
        }

        let value = try await mutex.withLock { 42 }
        XCTAssertEqual(value, 42)
    }

    func testOperationReturnAndThrowBothReleaseMutex() async throws {
        let mutex = AsyncSessionMutex()
        let value = try await mutex.withLock { "returned" }
        XCTAssertEqual(value, "returned")

        do {
            try await mutex.withLock { throw TestOperationError() }
            XCTFail("throwing operation unexpectedly returned")
        } catch {
            XCTAssertEqual(error as? TestOperationError, TestOperationError())
        }

        let afterThrow = try await mutex.withLock { "released" }
        XCTAssertEqual(afterThrow, "released")
    }

    private func waitForWaiterCount(_ count: Int, mutex: AsyncSessionMutex) async {
        for _ in 0..<10_000 where mutex.queuedWaiterCount != count {
            await Task.yield()
        }
        XCTAssertEqual(mutex.queuedWaiterCount, count)
    }
}

final class FileSessionCoordinationTests: XCTestCase {
    func testSameFileCoordinatorSerializesOperations() async throws {
        let url = temporaryLockURL()
        let coordinator = FileSessionCoordinator(lockFileURL: url, acquisitionTimeout: 1)
        try await assertSerializes(first: coordinator, second: coordinator)
    }

    func testSeparateCoordinatorsForCanonicalSamePathSerialize() async throws {
        let directory = temporaryDirectory()
        let nested = directory.appendingPathComponent("nested", isDirectory: true)
        try FileManager.default.createDirectory(at: nested, withIntermediateDirectories: true)
        let directURL = directory.appendingPathComponent("session.lock")
        let aliasURL = nested.appendingPathComponent("../session.lock")
        let first = FileSessionCoordinator(lockFileURL: directURL, acquisitionTimeout: 1)
        let second = FileSessionCoordinator(lockFileURL: aliasURL, acquisitionTimeout: 1)

        try await assertSerializes(first: first, second: second)
    }

    func testCanonicalSamePathNestedAcquisitionFailsImmediately() async throws {
        let url = temporaryLockURL()
        let first = FileSessionCoordinator(lockFileURL: url, acquisitionTimeout: 1)
        let second = FileSessionCoordinator(lockFileURL: url, acquisitionTimeout: 1)

        try await first.withCoordination {
            do {
                try await second.withCoordination {}
                XCTFail("nested canonical-path acquisition unexpectedly succeeded")
            } catch {
                XCTAssertEqual(error as? SessionCoordinationError, .reentrantAcquisition)
            }
        }
        try await second.withCoordination {}
    }

    func testZeroTimeoutStillAttemptsImmediatelyAvailableOwnership() async throws {
        let coordinator = FileSessionCoordinator(
            lockFileURL: temporaryLockURL(),
            acquisitionTimeout: 0
        )
        try await coordinator.withCoordination {}
    }

    func testDifferentPathsDoNotBlockOneAnother() async throws {
        let directory = temporaryDirectory()
        let first = FileSessionCoordinator(
            lockFileURL: directory.appendingPathComponent("first.lock"),
            acquisitionTimeout: 1
        )
        let second = FileSessionCoordinator(
            lockFileURL: directory.appendingPathComponent("second.lock"),
            acquisitionTimeout: 1
        )
        let releaseFirst = CoordinationSignal()
        let firstEntered = CoordinationSignal()
        let secondEntered = CoordinationSignal()

        let firstTask = Task {
            try await first.withCoordination {
                await firstEntered.signal()
                await releaseFirst.wait()
            }
        }
        await firstEntered.wait()

        let secondTask = Task {
            try await second.withCoordination {
                await secondEntered.signal()
            }
        }
        await secondEntered.wait()
        try await secondTask.value
        await releaseFirst.signal()
        try await firstTask.value
    }

    func testTimeoutWhileSameProcessOwnerIsLive() async throws {
        let url = temporaryLockURL()
        let holder = FileSessionCoordinator(lockFileURL: url, acquisitionTimeout: 1)
        let contender = FileSessionCoordinator(lockFileURL: url, acquisitionTimeout: 0.03)
        let release = CoordinationSignal()
        let entered = CoordinationSignal()

        let holderTask = Task {
            try await holder.withCoordination {
                await entered.signal()
                await release.wait()
            }
        }
        await entered.wait()

        do {
            try await contender.withCoordination {}
            XCTFail("contender unexpectedly acquired ownership")
        } catch {
            XCTAssertEqual(error as? SessionCoordinationError, .timedOut)
        }

        await release.signal()
        try await holderTask.value
    }

    func testCancellationIgnoringHeldOperationRetainsOwnershipUntilUnwind() async throws {
        let url = temporaryLockURL()
        let holder = FileSessionCoordinator(lockFileURL: url, acquisitionTimeout: 1)
        let contender = FileSessionCoordinator(lockFileURL: url, acquisitionTimeout: 0.03)
        let operationBarrier = CoordinationSignal()
        let entered = CoordinationSignal()

        let holderTask = Task {
            try await holder.withCoordination {
                await entered.signal()
                // Continuation waiting intentionally ignores task cancellation.
                await operationBarrier.wait()
            }
        }
        await entered.wait()
        holderTask.cancel()

        do {
            try await contender.withCoordination {}
            XCTFail("cancelled holder released before its operation unwound")
        } catch {
            XCTAssertEqual(error as? SessionCoordinationError, .timedOut)
        }

        await operationBarrier.signal()
        try await holderTask.value

        let afterUnwind = FileSessionCoordinator(lockFileURL: url, acquisitionTimeout: 0.2)
        try await afterUnwind.withCoordination {}
    }

    func testConfiguredPollingIsClampedToMinimumInterval() async throws {
        let fake = FakeFileLockSystem(
            flockResults: [
                .init(result: -1, error: EWOULDBLOCK),
                .init(result: 0, error: 0)
            ]
        )
        let sleeps = CoordinationSleepRecorder()
        let coordinator = FileSessionCoordinator(
            lockFileURL: temporaryLockURL(),
            acquisitionTimeout: 1,
            pollInterval: 0,
            sleeper: { interval in sleeps.record(interval) },
            system: fake.system
        )

        try await coordinator.withCoordination {}

        XCTAssertEqual(sleeps.snapshot(), [FileSessionCoordinator.minimumPollInterval])
    }

    func testFileDescriptorFlagsEINTRAndThrowCleanup() async throws {
        let fake = FakeFileLockSystem(
            flockResults: [
                .init(result: -1, error: EINTR),
                .init(result: 0, error: 0)
            ]
        )
        let coordinator = FileSessionCoordinator(
            lockFileURL: temporaryLockURL(),
            acquisitionTimeout: 1,
            system: fake.system
        )

        do {
            try await coordinator.withCoordination { throw TestOperationError() }
            XCTFail("throwing operation unexpectedly returned")
        } catch {
            XCTAssertEqual(error as? TestOperationError, TestOperationError())
        }

        let snapshot = fake.snapshot()
        XCTAssertEqual(snapshot.openFlags, O_CREAT | O_RDWR | O_CLOEXEC)
        XCTAssertEqual(snapshot.openMode, 0o600)
        XCTAssertEqual(snapshot.changedMode, 0o600)
        XCTAssertEqual(snapshot.flockOperations, [LOCK_EX | LOCK_NB, LOCK_EX | LOCK_NB, LOCK_UN])
        XCTAssertEqual(snapshot.closeCount, 1)
    }

    func testTimedOutFileAcquisitionClosesWithoutUnlocking() async throws {
        let fake = FakeFileLockSystem(
            flockResults: Array(
                repeating: .init(result: -1, error: EWOULDBLOCK),
                count: 20
            )
        )
        let coordinator = FileSessionCoordinator(
            lockFileURL: temporaryLockURL(),
            acquisitionTimeout: 0.025,
            pollInterval: 0.010,
            system: fake.system
        )

        do {
            try await coordinator.withCoordination {}
            XCTFail("contended file acquisition unexpectedly succeeded")
        } catch {
            XCTAssertEqual(error as? SessionCoordinationError, .timedOut)
        }

        let snapshot = fake.snapshot()
        XCTAssertFalse(snapshot.flockOperations.contains(LOCK_UN))
        XCTAssertEqual(snapshot.closeCount, 1)
    }

    private func assertSerializes(
        first: FileSessionCoordinator,
        second: FileSessionCoordinator
    ) async throws {
        let releaseFirst = CoordinationSignal()
        let firstEntered = CoordinationSignal()
        let secondStarted = CoordinationSignal()
        let recorder = CoordinationRecorder()

        let firstTask = Task {
            try await first.withCoordination {
                await recorder.enter(1)
                await firstEntered.signal()
                await releaseFirst.wait()
                await recorder.leave()
            }
        }
        await firstEntered.wait()

        let secondTask = Task {
            await secondStarted.signal()
            try await second.withCoordination {
                await recorder.enter(2)
                await recorder.leave()
            }
        }
        await secondStarted.wait()
        try await Task.sleep(for: .milliseconds(20))
        let whileHeld = await recorder.snapshot()
        XCTAssertEqual(whileHeld.values, [1])
        XCTAssertEqual(whileHeld.maximumActive, 1)

        await releaseFirst.signal()
        try await firstTask.value
        try await secondTask.value
        let finished = await recorder.snapshot()
        XCTAssertEqual(finished.values, [1, 2])
        XCTAssertEqual(finished.maximumActive, 1)
    }

    private func temporaryDirectory() -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("nhost-session-coordination-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        addTeardownBlock {
            try? FileManager.default.removeItem(at: directory)
        }
        return directory
    }

    private func temporaryLockURL() -> URL {
        temporaryDirectory().appendingPathComponent("session.lock")
    }
}
