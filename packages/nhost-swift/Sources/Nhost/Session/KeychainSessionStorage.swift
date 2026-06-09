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

    public init(
        service: String = "io.nhost.swift.session",
        accountPrefix: String = "default",
        accessGroup: String? = nil,
        accessibility: KeychainAccessibility = .afterFirstUnlockThisDeviceOnly
    ) {
        self.service = service
        account = "\(accountPrefix).nhostSession"
        self.accessGroup = accessGroup
        self.accessibility = accessibility
    }
}

public struct KeychainSessionStorageError: Error, Sendable, Equatable {
    public let status: OSStatus
    public let operation: String

    public init(status: OSStatus, operation: String) {
        self.status = status
        self.operation = operation
    }
}

/// Keychain-backed persistent session storage for Apple platforms.
public struct KeychainSessionStorageBackend: SessionStorageBackend {
    private let options: KeychainSessionStorageOptions

    public init(options: KeychainSessionStorageOptions = KeychainSessionStorageOptions()) {
        self.options = options
    }

    public func get() async throws -> StoredSession? {
        var query = baseQuery()
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)

        if status == errSecItemNotFound {
            return nil
        }

        guard status == errSecSuccess else {
            throw KeychainSessionStorageError(status: status, operation: "get")
        }

        guard let data = item as? Data else {
            throw KeychainSessionStorageError(status: errSecDecode, operation: "get")
        }

        return try NhostJSON.restDecoder.decode(StoredSession.self, from: data)
    }

    public func set(_ value: StoredSession) async throws {
        let data = try NhostJSON.restEncoder.encode(value)
        try await remove()

        var item = baseQuery()
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = options.accessibility.value

        let status = SecItemAdd(item as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainSessionStorageError(status: status, operation: "set")
        }
    }

    public func remove() async throws {
        let status = SecItemDelete(baseQuery() as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainSessionStorageError(status: status, operation: "remove")
        }
    }

    private func baseQuery() -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: options.service,
            kSecAttrAccount as String: options.account,
        ]

        if let accessGroup = options.accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
        }

        return query
    }
}
#endif
