#if canImport(Security)
import Foundation
import Security
import XCTest
@testable import Nhost

final class RecordingKeychainSecurityCommands: KeychainSecurityCommands, @unchecked Sendable {
    enum Kind: Sendable, Equatable {
        case copyMatching
        case update
        case add
        case delete
    }

    struct Invocation: Sendable, Equatable {
        let kind: Kind
        let queriedAccount: String?
        let replacementAccount: String?
        let valueData: Data?
        let accessibility: String?
    }

    private let lock = NSLock()
    private var copyResults: [KeychainSecurityCopyResult]
    private var updateStatuses: [OSStatus]
    private var addStatuses: [OSStatus]
    private var deleteStatuses: [OSStatus]
    private var invocations: [Invocation] = []

    init(
        copyResults: [KeychainSecurityCopyResult] = [],
        updateStatuses: [OSStatus] = [],
        addStatuses: [OSStatus] = [],
        deleteStatuses: [OSStatus] = []
    ) {
        self.copyResults = copyResults
        self.updateStatuses = updateStatuses
        self.addStatuses = addStatuses
        self.deleteStatuses = deleteStatuses
    }

    func copyMatching(_ query: [String: Any]) -> KeychainSecurityCopyResult {
        lock.withLock {
            invocations.append(Invocation(kind: .copyMatching, query: query))
            return copyResults.removeFirst()
        }
    }

    func update(_ query: [String: Any], attributes: [String: Any]) -> OSStatus {
        lock.withLock {
            invocations.append(
                Invocation(kind: .update, query: query, attributes: attributes)
            )
            return updateStatuses.removeFirst()
        }
    }

    func add(_ attributes: [String: Any]) -> OSStatus {
        lock.withLock {
            invocations.append(Invocation(kind: .add, attributes: attributes))
            return addStatuses.removeFirst()
        }
    }

    func delete(_ query: [String: Any]) -> OSStatus {
        lock.withLock {
            invocations.append(Invocation(kind: .delete, query: query))
            return deleteStatuses.removeFirst()
        }
    }

    func recordedInvocations() -> [Invocation] {
        lock.withLock { invocations }
    }
}

extension RecordingKeychainSecurityCommands.Invocation {
    init(
        kind: RecordingKeychainSecurityCommands.Kind,
        query: [String: Any] = [:],
        attributes: [String: Any] = [:]
    ) {
        self.init(
            kind: kind,
            queriedAccount: query[kSecAttrAccount as String] as? String,
            replacementAccount: attributes[kSecAttrAccount as String] as? String,
            valueData: attributes[kSecValueData as String] as? Data,
            accessibility: attributes[kSecAttrAccessible as String].map(String.init(describing:))
        )
    }
}

private enum KeychainStressError: Error {
    case missingSession
}

final class KeychainSessionStorageTests: XCTestCase {
    private static func options(
        accessibility: KeychainAccessibility = .afterFirstUnlockThisDeviceOnly
    ) -> KeychainSessionStorageOptions {
        KeychainSessionStorageOptions(
            service: "io.nhost.swift.tests.\(UUID().uuidString)",
            accountPrefix: "keychain-storage",
            accessibility: accessibility,
            useDataProtectionKeychain: false
        )
    }

    func testSetAddsWhenInitialUpdateFindsNoItem() async throws {
        let commands = RecordingKeychainSecurityCommands(
            updateStatuses: [errSecItemNotFound],
            addStatuses: [errSecSuccess]
        )
        let backend = KeychainSessionStorageBackend(options: Self.options(), commands: commands)
        let session = try StoredSession(try testAuthSession())

        try await backend.set(session)

        let invocations = commands.recordedInvocations()
        XCTAssertEqual(invocations.map(\.kind), [.update, .add])
        XCTAssertEqual(invocations[0].valueData, invocations[1].valueData)
        XCTAssertNotNil(invocations[0].valueData)
        XCTAssertFalse(invocations.contains { $0.kind == .delete })
    }

    func testSetUpdatesExistingItemInPlace() async throws {
        let commands = RecordingKeychainSecurityCommands(updateStatuses: [errSecSuccess])
        let backend = KeychainSessionStorageBackend(options: Self.options(), commands: commands)

        try await backend.set(try StoredSession(try testAuthSession()))

        XCTAssertEqual(commands.recordedInvocations().map(\.kind), [.update])
    }

    func testSetRetriesUpdateAfterDuplicateAddRace() async throws {
        let commands = RecordingKeychainSecurityCommands(
            updateStatuses: [errSecItemNotFound, errSecSuccess],
            addStatuses: [errSecDuplicateItem]
        )
        let backend = KeychainSessionStorageBackend(options: Self.options(), commands: commands)

        try await backend.set(try StoredSession(try testAuthSession()))

        let invocations = commands.recordedInvocations()
        XCTAssertEqual(invocations.map(\.kind), [.update, .add, .update])
        XCTAssertEqual(invocations[0].valueData, invocations[1].valueData)
        XCTAssertEqual(invocations[1].valueData, invocations[2].valueData)
        XCTAssertFalse(invocations.contains { $0.kind == .delete })
    }

    func testSetUpdatesAccessibilityAlongsideValue() async throws {
        let accessibility = KeychainAccessibility.whenUnlocked
        let commands = RecordingKeychainSecurityCommands(updateStatuses: [errSecSuccess])
        let backend = KeychainSessionStorageBackend(
            options: Self.options(accessibility: accessibility),
            commands: commands
        )

        try await backend.set(try StoredSession(try testAuthSession()))

        let invocation = try XCTUnwrap(commands.recordedInvocations().first)
        XCTAssertEqual(invocation.accessibility, String(describing: accessibility.value))
        XCTAssertNotNil(invocation.valueData)
    }

    func testRemoveExplicitlyDeletesAndAcceptsMissingItem() async throws {
        let commands = RecordingKeychainSecurityCommands(
            deleteStatuses: [errSecSuccess, errSecItemNotFound]
        )
        let backend = KeychainSessionStorageBackend(options: Self.options(), commands: commands)

        try await backend.remove()
        try await backend.remove()

        XCTAssertEqual(commands.recordedInvocations().map(\.kind), [.delete, .delete])
    }

    func testCorruptReadThrowsWithoutDeleting() async throws {
        let commands = RecordingKeychainSecurityCommands(
            copyResults: [KeychainSecurityCopyResult(status: errSecSuccess, data: Data("corrupt".utf8))],
            deleteStatuses: [errSecSuccess]
        )
        let backend = KeychainSessionStorageBackend(options: Self.options(), commands: commands)

        do {
            _ = try await backend.get()
            XCTFail("Expected corrupt Keychain data to throw")
        } catch {
            XCTAssertEqual(error as? KeychainSessionStorageError, .decoding)
        }

        XCTAssertEqual(commands.recordedInvocations().map(\.kind), [.copyMatching])
    }

    func testAuthorizationSnapshotPropagatesCorruptReadWithoutDeleting() async throws {
        let commands = RecordingKeychainSecurityCommands(
            copyResults: [KeychainSecurityCopyResult(status: errSecSuccess, data: Data("corrupt".utf8))],
            deleteStatuses: [errSecSuccess]
        )
        let backend = KeychainSessionStorageBackend(options: Self.options(), commands: commands)
        let store = SessionStore(storage: backend)

        do {
            _ = try await store.authorizationSnapshot()
            XCTFail("Expected authorization snapshot to fail closed")
        } catch {
            XCTAssertEqual(error as? KeychainSessionStorageError, .decoding)
        }

        XCTAssertEqual(commands.recordedInvocations().map(\.kind), [.copyMatching])
    }

    func testKeychainStorageRoundTripWhenExplicitlyEnabled() async throws {
        try requireRealKeychainTests()
        let backend = KeychainSessionStorageBackend(options: Self.options())
        let initial = try StoredSession(try testAuthSession(refreshToken: "initial"))
        let replacement = try StoredSession(try testAuthSession(refreshToken: "replacement"))

        try? await backend.remove()
        do {
            try await backend.set(initial)
            let storedInitial = try await backend.get()
            XCTAssertEqual(storedInitial?.refreshToken, "initial")
            try await backend.set(replacement)
            let storedReplacement = try await backend.get()
            XCTAssertEqual(storedReplacement?.refreshToken, "replacement")
            try await backend.remove()
            let removed = try await backend.get()
            XCTAssertNil(removed)
        } catch {
            try? await backend.remove()
            throw error
        }
    }

    func testCorruptKeychainEntryRequiresExplicitRecoveryWhenExplicitlyEnabled() async throws {
        try requireRealKeychainTests()
        let options = Self.options()
        let backend = KeychainSessionStorageBackend(options: options)

        try? await backend.remove()
        let corrupted: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: options.service,
            kSecAttrAccount as String: options.account,
            kSecValueData as String: Data("not a session".utf8)
        ]
        XCTAssertEqual(SecItemAdd(corrupted as CFDictionary, nil), errSecSuccess)

        do {
            do {
                _ = try await backend.get()
                XCTFail("Expected corrupt Keychain data to throw")
            } catch {
                XCTAssertEqual(error as? KeychainSessionStorageError, .decoding)
            }

            var persisted: CFTypeRef?
            var query = corrupted
            query.removeValue(forKey: kSecValueData as String)
            query[kSecReturnData as String] = true
            XCTAssertEqual(SecItemCopyMatching(query as CFDictionary, &persisted), errSecSuccess)
            XCTAssertEqual(persisted as? Data, Data("not a session".utf8))

            let replacement = try StoredSession(try testAuthSession(refreshToken: "recovered"))
            try await backend.set(replacement)
            let recovered = try await backend.get()
            XCTAssertEqual(recovered?.refreshToken, "recovered")
            try await backend.remove()
        } catch {
            try? await backend.remove()
            throw error
        }
    }

    func testConcurrentReadersNeverObserveMissingSessionDuringReplacementWhenExplicitlyEnabled() async throws {
        try requireRealKeychainTests()
        let backend = KeychainSessionStorageBackend(options: Self.options())
        let sessions = try (0..<8).map { index in
            try StoredSession(
                testAuthSession(
                    refreshToken: "refresh-\(index)",
                    refreshTokenId: "refresh-id-\(index)"
                )
            )
        }

        try? await backend.remove()
        do {
            try await backend.set(sessions[0])
            try await withThrowingTaskGroup(of: Void.self) { group in
                for _ in 0..<4 {
                    group.addTask {
                        for iteration in 0..<200 {
                            guard try await backend.get() != nil else {
                                throw KeychainStressError.missingSession
                            }
                            if iteration.isMultiple(of: 10) {
                                await Task.yield()
                            }
                        }
                    }
                }

                for writer in 0..<4 {
                    group.addTask {
                        for iteration in 0..<100 {
                            try await backend.set(sessions[(writer + iteration) % sessions.count])
                            if iteration.isMultiple(of: 10) {
                                await Task.yield()
                            }
                        }
                    }
                }

                try await group.waitForAll()
            }

            let finalSession = try await backend.get()
            XCTAssertNotNil(finalSession)
            try await backend.remove()
        } catch {
            try? await backend.remove()
            throw error
        }
    }

    private func requireRealKeychainTests() throws {
        guard ProcessInfo.processInfo.environment["NHOST_SWIFT_RUN_KEYCHAIN_TESTS"] == "1" else {
            throw XCTSkip("Set NHOST_SWIFT_RUN_KEYCHAIN_TESTS=1 to run real-Keychain tests")
        }
    }
}
#endif
