import Foundation

#if canImport(Security)
import Security

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
}

public enum KeychainSessionStorageError: Error, Sendable, Equatable {
    case security(status: OSStatus, operation: String)
    case decoding
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
    private let commands: any KeychainSecurityCommands

    public init(options: KeychainSessionStorageOptions = KeychainSessionStorageOptions()) {
        self.options = options
        commands = SystemKeychainSecurityCommands()
    }

    init(
        options: KeychainSessionStorageOptions = KeychainSessionStorageOptions(),
        commands: any KeychainSecurityCommands
    ) {
        self.options = options
        self.commands = commands
    }

    public func get() async throws -> StoredSession? {
        var query = baseQuery()
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

    public func set(_ value: StoredSession) async throws {
        let data = try NhostJSON.restEncoder.encode(value)
        let query = baseQuery()
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
        let status = commands.delete(baseQuery())
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainSessionStorageError.security(status: status, operation: "remove")
        }
    }

    private func baseQuery() -> [String: Any] {
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
