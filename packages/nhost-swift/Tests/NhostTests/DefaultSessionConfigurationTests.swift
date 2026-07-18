import Foundation
import XCTest
@testable import Nhost

final class DefaultSessionConfigurationTests: XCTestCase {
    func testLegacyPolicyAppliesOnlyToThePlatformDefault() {
        XCTAssertEqual(
            SessionManagementConfiguration().legacyDefaultSessionMigration,
            .requireExplicitDecision
        )
        XCTAssertNil(
            SessionManagementConfiguration.processLocal(
                storage: MemorySessionStorageBackend()
            ).legacyDefaultSessionMigration
        )
    }

    func testIdentityCanonicalizesOneAuthBaseAndSeparatesProjects() throws {
        let first = DefaultSessionPersistenceIdentity(
            authBaseURL: try XCTUnwrap(URL(string: "HTTPS://AUTH.EXAMPLE.TEST:443/v1/"))
        )
        let equivalent = DefaultSessionPersistenceIdentity(
            authBaseURL: try XCTUnwrap(URL(string: "https://auth.example.test/v1"))
        )
        let differentProject = DefaultSessionPersistenceIdentity(
            authBaseURL: try XCTUnwrap(URL(string: "https://other-auth.example.test/v1"))
        )
        let differentBasePath = DefaultSessionPersistenceIdentity(
            authBaseURL: try XCTUnwrap(URL(string: "https://auth.example.test/tenant/v1"))
        )

        XCTAssertEqual(first, equivalent)
        XCTAssertNotEqual(first, differentProject)
        XCTAssertNotEqual(first, differentBasePath)
        XCTAssertEqual(first.digest.count, 64)
    }

    func testSeparateProcessLocalCoordinatorsWithSameIdentitySerialize() async throws {
        let identity = "session-\(UUID().uuidString)"
        let first = ProcessLocalSessionCoordinator(identity: identity)
        let second = ProcessLocalSessionCoordinator(identity: identity)

        try await assertSerializes(first: first, second: second)
    }

    #if canImport(Security)
    func testDefaultResolutionScopesKeychainAndCoordinatesSameOrigin() async throws {
        let configuration = SessionManagementConfiguration(legacyDefaultSessionMigration: .ignore)
        let firstURL = try XCTUnwrap(URL(string: "https://project.auth.example.test/v1"))
        let secondURL = try XCTUnwrap(URL(string: "https://other.auth.example.test/v1"))
        let first = configuration.resolved(authBaseURL: firstURL)
        let same = configuration.resolved(authBaseURL: firstURL)
        let different = configuration.resolved(authBaseURL: secondURL)
        let firstStorage = try XCTUnwrap(first.storage as? KeychainSessionStorageBackend)
        let sameStorage = try XCTUnwrap(same.storage as? KeychainSessionStorageBackend)
        let differentStorage = try XCTUnwrap(different.storage as? KeychainSessionStorageBackend)

        XCTAssertEqual(firstStorage.storageAccount, sameStorage.storageAccount)
        XCTAssertNotEqual(firstStorage.storageAccount, differentStorage.storageAccount)
        try await assertSerializes(first: first.coordinator, second: same.coordinator)
    }
    #endif

    private func assertSerializes(
        first: any SessionCoordinator,
        second: any SessionCoordinator
    ) async throws {
        let releaseFirst = CoordinationSignal()
        let firstEntered = CoordinationSignal()
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
            try await second.withCoordination {
                await recorder.enter(2)
                await recorder.leave()
            }
        }
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
}
