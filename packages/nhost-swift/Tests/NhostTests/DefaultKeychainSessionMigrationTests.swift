#if canImport(Security)
import Foundation
import Security
import XCTest
@testable import Nhost

final class DefaultKeychainSessionMigrationTests: XCTestCase {
    func testRequiresExplicitDecisionWhenLegacyItemExists() async throws {
        let (scoped, legacy) = options()
        let sessionData = try NhostJSON.restEncoder.encode(
            StoredSession(try testAuthSession(refreshToken: "legacy"))
        )
        let commands = RecordingKeychainSecurityCommands(
            copyResults: [
                KeychainSecurityCopyResult(status: errSecItemNotFound, data: nil),
                KeychainSecurityCopyResult(status: errSecSuccess, data: sessionData)
            ]
        )
        let backend = KeychainSessionStorageBackend(
            options: scoped,
            legacyOptions: legacy,
            legacyMigration: .requireExplicitDecision,
            commands: commands
        )

        do {
            _ = try await backend.get()
            XCTFail("Expected legacy migration decision to be required")
        } catch {
            XCTAssertEqual(
                error as? KeychainSessionStorageError,
                .legacyDefaultSessionMigrationRequired
            )
        }

        let invocations = commands.recordedInvocations()
        XCTAssertEqual(invocations.map(\.kind), [.copyMatching, .copyMatching])
        XCTAssertEqual(invocations.map(\.queriedAccount), [scoped.account, legacy.account])
    }

    func testExplicitMigrationAtomicallyMovesItemToScopedAccount() async throws {
        let (scoped, legacy) = options()
        let stored = try StoredSession(try testAuthSession(refreshToken: "legacy"))
        let sessionData = try NhostJSON.restEncoder.encode(stored)
        let commands = RecordingKeychainSecurityCommands(
            copyResults: [
                KeychainSecurityCopyResult(status: errSecItemNotFound, data: nil),
                KeychainSecurityCopyResult(status: errSecSuccess, data: sessionData)
            ],
            updateStatuses: [errSecSuccess]
        )
        let backend = KeychainSessionStorageBackend(
            options: scoped,
            legacyOptions: legacy,
            legacyMigration: .migrateToCurrentAuthOrigin,
            commands: commands
        )

        let migrated = try await backend.get()

        XCTAssertEqual(migrated?.refreshToken, stored.refreshToken)
        let invocations = commands.recordedInvocations()
        XCTAssertEqual(invocations.map(\.kind), [.copyMatching, .update, .copyMatching])
        XCTAssertEqual(invocations[1].queriedAccount, legacy.account)
        XCTAssertEqual(invocations[1].replacementAccount, scoped.account)
        XCTAssertFalse(invocations.contains { $0.kind == .delete })
    }

    func testIgnoringLegacyItemLeavesItUntouchedAndReturnsNoSession() async throws {
        let (scoped, legacy) = options()
        let commands = RecordingKeychainSecurityCommands(
            copyResults: [KeychainSecurityCopyResult(status: errSecItemNotFound, data: nil)]
        )
        let backend = KeychainSessionStorageBackend(
            options: scoped,
            legacyOptions: legacy,
            legacyMigration: .ignore,
            commands: commands
        )

        let session = try await backend.get()

        XCTAssertNil(session)
        let invocations = commands.recordedInvocations()
        XCTAssertEqual(invocations.map(\.kind), [.copyMatching])
        XCTAssertEqual(invocations.first?.queriedAccount, scoped.account)
    }

    private func options() -> (
        scoped: KeychainSessionStorageOptions,
        legacy: KeychainSessionStorageOptions
    ) {
        let service = "io.nhost.swift.tests.\(UUID().uuidString)"
        return (
            KeychainSessionStorageOptions(service: service, accountPrefix: "origin.digest"),
            KeychainSessionStorageOptions(service: service, accountPrefix: "default")
        )
    }
}
#endif
