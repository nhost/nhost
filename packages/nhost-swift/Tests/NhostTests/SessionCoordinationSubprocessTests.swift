import Foundation
import XCTest
@testable import Nhost

#if os(macOS) || os(Linux)
final class SessionCoordinationSubprocessTests: XCTestCase {
    func testSubprocessNormalCloseReleasesOwnership() async throws {
        try await assertSubprocessRelease(mode: "close", expectedExitStatus: 0)
    }

    func testSubprocessCrashReleasesOwnership() async throws {
        try await assertSubprocessRelease(mode: "crash", expectedExitStatus: 99)
    }

    private func assertSubprocessRelease(mode: String, expectedExitStatus: Int32) async throws {
        let lockURL = temporaryLockURL()
        let process = Process()
        let input = Pipe()
        let output = Pipe()
        process.executableURL = try coordinationHelperURL()
        process.arguments = [lockURL.path, mode]
        process.standardInput = input
        process.standardOutput = output
        process.standardError = output
        try process.run()

        let ready = output.fileHandleForReading.readData(ofLength: 6)
        XCTAssertEqual(String(bytes: ready, encoding: .utf8), "READY\n")

        let contender = FileSessionCoordinator(lockFileURL: lockURL, acquisitionTimeout: 0.04)
        do {
            try await contender.withCoordination {}
            XCTFail("acquired while subprocess still held the file lock")
        } catch {
            XCTAssertEqual(error as? SessionCoordinationError, .timedOut)
        }

        input.fileHandleForWriting.write(Data([0x0A]))
        input.fileHandleForWriting.closeFile()
        process.waitUntilExit()
        XCTAssertEqual(process.terminationStatus, expectedExitStatus)

        let afterExit = FileSessionCoordinator(lockFileURL: lockURL, acquisitionTimeout: 0.5)
        try await afterExit.withCoordination {}
    }

    private func temporaryLockURL() -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("nhost-session-coordination-\(UUID().uuidString)", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        addTeardownBlock {
            try? FileManager.default.removeItem(at: directory)
        }
        return directory.appendingPathComponent("session.lock")
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
                let values = try candidate.resourceValues(forKeys: [.isRegularFileKey, .isExecutableKey])
                if values.isRegularFile == true, values.isExecutable == true {
                    return candidate
                }
            }
        }

        throw XCTSkip("build NhostSessionCoordinationTestHelper before running subprocess tests")
    }
}
#endif
