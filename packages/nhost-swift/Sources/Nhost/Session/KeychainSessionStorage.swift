import Foundation

#if canImport(Security)
import Security

func currentProcessHasAppGroupEntitlement(_ identifier: String) -> Bool {
    #if os(macOS)
    guard let task = SecTaskCreateFromSelf(nil),
          let entitlement = SecTaskCopyValueForEntitlement(
              task,
              "com.apple.security.application-groups" as CFString,
              nil
          ) as? [String] else {
        return false
    }
    return entitlement.contains(identifier)
    #else
    return true
    #endif
}

public enum KeychainAccessibility: String, Sendable {
    case afterFirstUnlock
    case afterFirstUnlockThisDeviceOnly
    case whenUnlocked
    case whenUnlockedThisDeviceOnly

    var value: CFString {
        switch self {
        case .afterFirstUnlock:
            kSecAttrAccessibleAfterFirstUnlock
        case .afterFirstUnlockThisDeviceOnly:
            kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        case .whenUnlocked:
            kSecAttrAccessibleWhenUnlocked
        case .whenUnlockedThisDeviceOnly:
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        }
    }
}

public struct KeychainSessionStorageOptions: Sendable {
    public let service: String
    public let account: String
    public let accessGroup: String?
    public let accessibility: KeychainAccessibility
    public let useDataProtectionKeychain: Bool

    /// - Parameter useDataProtectionKeychain: On macOS, stores the session in the
    ///   data-protection keychain (the iOS-style keychain) instead of the legacy
    ///   file-based login keychain, where `accessibility` and `accessGroup` are
    ///   silently ignored. Requires a keychain/application-identifier entitlement,
    ///   which regular signed apps have; plain unsigned executables (CLI tools, ad
    ///   hoc test runners) must pass `false`. Ignored on iOS/tvOS/watchOS, where
    ///   the keychain is always data-protected.
    public init(
        service: String = "io.nhost.swift.session",
        accountPrefix: String = "default",
        accessGroup: String? = nil,
        accessibility: KeychainAccessibility = .afterFirstUnlockThisDeviceOnly,
        useDataProtectionKeychain: Bool = true
    ) {
        self.service = service
        account = "\(accountPrefix).\(defaultSessionKey)"
        self.accessGroup = accessGroup
        self.accessibility = accessibility
        self.useDataProtectionKeychain = useDataProtectionKeychain
    }

    private init(
        service: String,
        account: String,
        accessGroup: String?,
        accessibility: KeychainAccessibility,
        useDataProtectionKeychain: Bool
    ) {
        self.service = service
        self.account = account
        self.accessGroup = accessGroup
        self.accessibility = accessibility
        self.useDataProtectionKeychain = useDataProtectionKeychain
    }

    func replacingAccessGroup(with accessGroup: String) -> KeychainSessionStorageOptions {
        KeychainSessionStorageOptions(
            service: service,
            account: account,
            accessGroup: accessGroup,
            accessibility: accessibility,
            useDataProtectionKeychain: useDataProtectionKeychain
        )
    }

    /// Canonical identity of the generic-password item addressed by
    /// ``KeychainSessionStorageBackend``. Mutable item attributes such as
    /// accessibility are deliberately excluded.
    var canonicalStorageIdentity: Data {
        var identity = Data([1])
        appendIdentityComponent("generic-password", to: &identity)
        appendIdentityComponent(service, to: &identity)
        appendIdentityComponent(account, to: &identity)
        #if os(macOS)
        identity.append(useDataProtectionKeychain ? 1 : 0)
        if useDataProtectionKeychain {
            appendAccessGroupIdentity(to: &identity)
        }
        #else
        appendAccessGroupIdentity(to: &identity)
        #endif
        return identity
    }

    private func appendAccessGroupIdentity(to identity: inout Data) {
        if let accessGroup {
            identity.append(1)
            appendIdentityComponent(accessGroup, to: &identity)
        } else {
            identity.append(0)
        }
    }

    private func appendIdentityComponent(_ component: String, to identity: inout Data) {
        let bytes = Data(component.utf8)
        var length = UInt64(bytes.count).bigEndian
        withUnsafeBytes(of: &length) { identity.append(contentsOf: $0) }
        identity.append(bytes)
    }
}

public enum KeychainSessionStorageError: Error, Sendable, Equatable {
    case security(status: OSStatus, operation: String)
    case decoding
    /// An unscoped item from an older SDK exists, but its Auth origin cannot be
    /// inferred safely. Configure an explicit legacy migration policy.
    case legacyDefaultSessionMigrationRequired
}

extension KeychainSessionStorageError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case let .security(status, operation):
            #if os(macOS)
            if status == errSecMissingEntitlement {
                return "The Keychain \(operation) operation failed because this macOS process "
                    + "lacks a required Keychain/application-identifier entitlement "
                    + "(OSStatus \(status)). Sign the executable with the required entitlement. "
                    + "For an unsigned or ad-hoc-signed CLI that does not share an access group, "
                    + "explicitly configure KeychainSessionStorageOptions("
                    + "useDataProtectionKeychain: false). The SDK does not fall back automatically."
            }
            #endif
            let detail = SecCopyErrorMessageString(status, nil) as String? ?? "unknown error"
            return "The Keychain \(operation) operation failed: \(detail) (OSStatus \(status))"
        case .decoding:
            return "The stored Keychain session could not be decoded"
        case .legacyDefaultSessionMigrationRequired:
            return "A legacy unscoped Keychain session requires an explicit migration decision"
        }
    }
}

struct KeychainSecurityCopyResult: Sendable {
    let status: OSStatus
    let data: Data?
}

protocol KeychainSecurityCommands: Sendable {
    func copyMatching(_ query: [String: Any]) -> KeychainSecurityCopyResult
    func update(_ query: [String: Any], attributes: [String: Any]) -> OSStatus
    func add(_ attributes: [String: Any]) -> OSStatus
    func delete(_ query: [String: Any]) -> OSStatus
}

private struct SystemKeychainSecurityCommands: KeychainSecurityCommands {
    func copyMatching(_ query: [String: Any]) -> KeychainSecurityCopyResult {
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        return KeychainSecurityCopyResult(status: status, data: item as? Data)
    }

    func update(_ query: [String: Any], attributes: [String: Any]) -> OSStatus {
        SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
    }

    func add(_ attributes: [String: Any]) -> OSStatus {
        SecItemAdd(attributes as CFDictionary, nil)
    }

    func delete(_ query: [String: Any]) -> OSStatus {
        SecItemDelete(query as CFDictionary)
    }
}

/// Keychain-backed persistent session storage for Apple platforms.
public struct KeychainSessionStorageBackend: SessionStorageBackend {
    private let options: KeychainSessionStorageOptions
    private let legacyOptions: KeychainSessionStorageOptions?
    var storageAccount: String { options.account }
    var storageOptions: KeychainSessionStorageOptions { options }
    private let legacyMigration: LegacyDefaultSessionMigrationPolicy
    private let commands: any KeychainSecurityCommands

    public init(options: KeychainSessionStorageOptions = KeychainSessionStorageOptions()) {
        self.options = options
        legacyOptions = nil
        legacyMigration = .ignore
        commands = SystemKeychainSecurityCommands()
    }

    init(
        options: KeychainSessionStorageOptions = KeychainSessionStorageOptions(),
        commands: any KeychainSecurityCommands
    ) {
        self.options = options
        legacyOptions = nil
        legacyMigration = .ignore
        self.commands = commands
    }

    init(
        options: KeychainSessionStorageOptions,
        legacyOptions: KeychainSessionStorageOptions,
        legacyMigration: LegacyDefaultSessionMigrationPolicy,
        commands: any KeychainSecurityCommands = SystemKeychainSecurityCommands()
    ) {
        self.options = options
        self.legacyOptions = legacyOptions
        self.legacyMigration = legacyMigration
        self.commands = commands
    }

    public func get() async throws -> StoredSession? {
        if let session = try read(options: options) {
            return session
        }
        guard let legacyOptions else {
            return nil
        }

        switch legacyMigration {
        case .requireExplicitDecision:
            guard try read(options: legacyOptions) == nil else {
                throw KeychainSessionStorageError.legacyDefaultSessionMigrationRequired
            }
            return nil
        case .migrateToCurrentAuthOrigin:
            return try migrateLegacyItem(from: legacyOptions)
        case .ignore:
            return nil
        }
    }

    public func set(_ value: StoredSession) async throws {
        let data = try NhostJSON.restEncoder.encode(value)
        let query = baseQuery(options: options)
        let updates: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: options.accessibility.value
        ]

        let updateStatus = commands.update(query, attributes: updates)
        if updateStatus == errSecSuccess {
            return
        }
        guard updateStatus == errSecItemNotFound else {
            throw KeychainSessionStorageError.security(status: updateStatus, operation: "set")
        }

        var item = query
        item.merge(updates) { _, replacement in replacement }
        let addStatus = commands.add(item)
        if addStatus == errSecSuccess {
            return
        }
        guard addStatus == errSecDuplicateItem else {
            throw KeychainSessionStorageError.security(status: addStatus, operation: "set")
        }

        let retryStatus = commands.update(query, attributes: updates)
        guard retryStatus == errSecSuccess else {
            throw KeychainSessionStorageError.security(status: retryStatus, operation: "set")
        }
    }

    public func remove() async throws {
        let status = commands.delete(baseQuery(options: options))
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainSessionStorageError.security(status: status, operation: "remove")
        }
    }

    private func read(options: KeychainSessionStorageOptions) throws -> StoredSession? {
        var query = baseQuery(options: options)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        let result = commands.copyMatching(query)
        if result.status == errSecItemNotFound {
            return nil
        }
        guard result.status == errSecSuccess else {
            throw KeychainSessionStorageError.security(status: result.status, operation: "get")
        }
        guard let data = result.data else {
            throw KeychainSessionStorageError.decoding
        }

        do {
            return try NhostJSON.restDecoder.decode(StoredSession.self, from: data)
        } catch {
            throw KeychainSessionStorageError.decoding
        }
    }

    private func migrateLegacyItem(
        from legacyOptions: KeychainSessionStorageOptions
    ) throws -> StoredSession? {
        let attributes: [String: Any] = [
            kSecAttrAccount as String: options.account,
            kSecAttrAccessible as String: options.accessibility.value
        ]
        let status = commands.update(
            baseQuery(options: legacyOptions),
            attributes: attributes
        )

        switch status {
        case errSecSuccess, errSecItemNotFound:
            return try read(options: options)
        case errSecDuplicateItem:
            guard let session = try read(options: options) else {
                throw KeychainSessionStorageError.security(
                    status: status,
                    operation: "migrate-legacy"
                )
            }
            return session
        default:
            throw KeychainSessionStorageError.security(
                status: status,
                operation: "migrate-legacy"
            )
        }
    }

    private func baseQuery(options: KeychainSessionStorageOptions) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: options.service,
            kSecAttrAccount as String: options.account
        ]

        #if os(macOS)
        query[kSecUseDataProtectionKeychain as String] = options.useDataProtectionKeychain
        #endif

        if let accessGroup = options.accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }

        return query
    }
}
#endif
