import Foundation
import XCTest
@testable import Nhost

#if os(macOS) || os(Linux)
extension GraphQLCachePolicyTests {
    func testOwnedDirectoryFailsCacheOnlyAndManagementWithoutRecoveryCleanup() async throws {
        let directory = ownershipTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let owner = try GraphQLCacheOwnerProcess(directory: directory, mode: "cache-close")
        defer { owner.terminateIfNeeded() }

        let interrupted = directory.appendingPathComponent(".interrupted.tmp")
        try Data("in-flight".utf8).write(to: interrupted)
        let queue = CacheResponseQueue([])
        let client = makeClient(
            queue: queue,
            configuration: GraphQLCacheConfiguration(
                directoryURL: directory,
                fileProtection: .none
            )
        )

        await assertCacheError(.directoryOwnedByAnotherProcess) {
            _ = try await client.request(
                CacheBoolData.self,
                query: self.query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
            )
        }
        await assertCacheError(.directoryOwnedByAnotherProcess) {
            try await client.cache.prune()
        }
        let cacheOnlyCalls = await queue.callCount()
        XCTAssertEqual(cacheOnlyCalls, 0)
        XCTAssertTrue(FileManager.default.fileExists(atPath: interrupted.path))

        try owner.signalAndWait(expectedExitStatus: 0)
        let staleLock = directory.appendingPathComponent(".nhost-graphql-cache.lock")
        XCTAssertTrue(FileManager.default.fileExists(atPath: staleLock.path))

        try await client.cache.prune()
        XCTAssertFalse(FileManager.default.fileExists(atPath: interrupted.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: staleLock.path))
    }

    func testNetworkCapablePolicyBypassesOwnedDirectoryAndReportsDiagnostics() async throws {
        let directory = ownershipTemporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let owner = try GraphQLCacheOwnerProcess(directory: directory, mode: "cache-close")
        defer { owner.terminateIfNeeded() }

        let diagnostics = CacheDiagnosticRecorder()
        let queue = CacheResponseQueue([.response(success(ok: true))])
        let client = makeClient(
            queue: queue,
            configuration: GraphQLCacheConfiguration(
                directoryURL: directory,
                fileProtection: .none,
                diagnosticObserver: diagnostics.record
            )
        )

        let response = try await client.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )

        let networkCalls = await queue.callCount()
        XCTAssertEqual(response.body.data?.ok, true)
        XCTAssertEqual(networkCalls, 1)
        XCTAssertTrue(diagnostics.kinds().contains(.storeReadFailure))
        XCTAssertTrue(diagnostics.kinds().contains(.storeWriteFailure))
        try owner.signalAndWait(expectedExitStatus: 0)
    }
}

final class GraphQLCacheOwnershipTests: GraphQLCacheStoreTestCase {
    func testSameProcessStoresShareOneBackend() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let configuration = fileConfiguration(directory: directory)
        let first = FileGraphQLCacheStore(configuration: configuration)
        let second = FileGraphQLCacheStore(configuration: configuration)
        let key = digestKey("same-process-shared-backend")

        try await first.write(entry(key: key), for: key)
        let sharedValue = try await second.entry(for: key)

        XCTAssertNotNil(sharedValue)
        XCTAssertTrue(
            FileManager.default.fileExists(
                atPath: directory.appendingPathComponent(".nhost-graphql-cache.lock").path
            )
        )
    }

    func testCrashReleasesOwnershipAndLeavesHarmlessLockFile() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let owner = try GraphQLCacheOwnerProcess(directory: directory, mode: "cache-crash")
        defer { owner.terminateIfNeeded() }

        try owner.signalAndWait(expectedExitStatus: 99)

        let store = FileGraphQLCacheStore(configuration: fileConfiguration(directory: directory))
        try await store.prune()
        XCTAssertTrue(
            FileManager.default.fileExists(
                atPath: directory.appendingPathComponent(".nhost-graphql-cache.lock").path
            )
        )
    }

    func testBackendDeinitReleasesOwnershipWhileProcessRemainsAlive() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let owner = try GraphQLCacheOwnerProcess(directory: directory, mode: "cache-deinit")
        defer { owner.terminateIfNeeded() }

        try owner.releaseBackend()

        let store = FileGraphQLCacheStore(configuration: fileConfiguration(directory: directory))
        try await store.prune()
        try owner.signalAndWait(expectedExitStatus: 0)
    }
}

private final class GraphQLCacheOwnerProcess: @unchecked Sendable {
    private let process = Process()
    private let input = Pipe()
    private let output = Pipe()

    init(directory: URL, mode: String) throws {
        process.executableURL = try coordinationHelperURL()
        process.arguments = [directory.path, mode]
        process.standardInput = input
        process.standardOutput = output
        process.standardError = output
        try process.run()

        let ready = output.fileHandleForReading.readData(ofLength: 6)
        guard String(bytes: ready, encoding: .utf8) == "READY\n" else {
            process.waitUntilExit()
            throw GraphQLCacheOwnerProcessError.failedToAcquire(outputString(ready))
        }
    }

    func releaseBackend() throws {
        input.fileHandleForWriting.write(Data([0x0A]))
        let released = output.fileHandleForReading.readData(ofLength: 9)
        guard String(bytes: released, encoding: .utf8) == "RELEASED\n" else {
            throw GraphQLCacheOwnerProcessError.failedToRelease(outputString(released))
        }
    }

    func signalAndWait(expectedExitStatus: Int32) throws {
        input.fileHandleForWriting.write(Data([0x0A]))
        input.fileHandleForWriting.closeFile()
        process.waitUntilExit()
        guard process.terminationStatus == expectedExitStatus else {
            let remainder = output.fileHandleForReading.readDataToEndOfFile()
            throw GraphQLCacheOwnerProcessError.unexpectedExit(
                process.terminationStatus,
                outputString(remainder)
            )
        }
    }

    func terminateIfNeeded() {
        guard process.isRunning else { return }
        process.terminate()
        input.fileHandleForWriting.closeFile()
        process.waitUntilExit()
    }
}

private func outputString(_ data: Data) -> String {
    String(bytes: data, encoding: .utf8) ?? "<non-UTF-8 helper output>"
}

private enum GraphQLCacheOwnerProcessError: Error {
    case failedToAcquire(String)
    case failedToRelease(String)
    case unexpectedExit(Int32, String)
    case helperNotFound
}

private func ownershipTemporaryDirectory() -> URL {
    FileManager.default.temporaryDirectory
        .appendingPathComponent("nhost-graphql-ownership-\(UUID().uuidString)", isDirectory: true)
}

private func coordinationHelperURL() throws -> URL {
    if let override = ProcessInfo.processInfo.environment["NHOST_SWIFT_COORDINATION_HELPER"] {
        return URL(fileURLWithPath: override)
    }

    let packageRoot = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .deletingLastPathComponent()
    let buildDirectory = packageRoot.appendingPathComponent(".build", isDirectory: true)
    if let enumerator = FileManager.default.enumerator(
        at: buildDirectory,
        includingPropertiesForKeys: [.isRegularFileKey, .isExecutableKey],
        options: [.skipsHiddenFiles]
    ) {
        for case let candidate as URL in enumerator
            where candidate.lastPathComponent == "NhostSessionCoordinationTestHelper" {
            let values = try candidate.resourceValues(
                forKeys: [.isRegularFileKey, .isExecutableKey]
            )
            if values.isRegularFile == true, values.isExecutable == true {
                return candidate
            }
        }
    }

    throw GraphQLCacheOwnerProcessError.helperNotFound
}
#endif
