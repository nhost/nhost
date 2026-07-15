import Foundation

public enum NhostSessionError: Error, Sendable, Equatable {
    case invalidAccessTokenFormat
    case invalidBase64URLPayload
    case invalidJSONPayload
}

extension NhostSessionError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .invalidAccessTokenFormat:
            "Invalid access token format"
        case .invalidBase64URLPayload:
            "Invalid access token payload encoding"
        case .invalidJSONPayload:
            "Invalid access token JSON payload"
        }
    }
}

/// Decoded JWT token payload with normalized timestamp and Hasura claim helpers.
public struct DecodedToken: Codable, Sendable {
    public static let hasuraClaimsKey = "https://hasura.io/jwt/claims"

    /// Token expiration time decoded from `exp`.
    public let exp: Date?
    /// Token issued-at time decoded from `iat`.
    public let iat: Date?
    /// Token issuer from `iss`.
    public let issuer: String?
    /// Token subject from `sub`.
    public let subject: String?
    /// Processed Hasura claims with PostgreSQL-array strings converted to JSON arrays.
    public let hasuraClaims: [String: JSONValue]?
    /// All decoded claims. `iat` and `exp` are normalized to millisecond values to mirror the JS SDK.
    public let claims: [String: JSONValue]

    public init(claims: [String: JSONValue]) {
        self.init(claims: claims, datesAreJWTSeconds: false)
    }

    private init(claims: [String: JSONValue], datesAreJWTSeconds: Bool) {
        let normalizedClaims = Self.normalizedClaims(claims, datesAreJWTSeconds: datesAreJWTSeconds)

        self.claims = normalizedClaims
        exp = Self.date(from: normalizedClaims["exp"], datesAreJWTSeconds: false)
        iat = Self.date(from: normalizedClaims["iat"], datesAreJWTSeconds: false)
        issuer = normalizedClaims["iss"]?.stringValue
        subject = normalizedClaims["sub"]?.stringValue

        if case let .object(hasuraClaims) = normalizedClaims[Self.hasuraClaimsKey] {
            self.hasuraClaims = hasuraClaims
        } else {
            self.hasuraClaims = nil
        }
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: DynamicCodingKey.self)
        var claims: [String: JSONValue] = [:]

        for key in container.allKeys {
            claims[key.stringValue] = try container.decode(JSONValue.self, forKey: key)
        }

        self.init(claims: claims, datesAreJWTSeconds: false)
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: DynamicCodingKey.self)

        for key in claims.keys.sorted() {
            guard let codingKey = DynamicCodingKey(stringValue: key), let value = claims[key] else {
                continue
            }
            try container.encode(value, forKey: codingKey)
        }
    }

    public subscript(key: String) -> JSONValue? {
        claims[key]
    }

    /// Claims that may affect authorization, excluding only the top-level JWT
    /// lifetime fields. Nested `iat`/`exp` values remain protected inputs.
    var stableAuthorizationClaims: [String: JSONValue] {
        claims.filter { key, _ in key != "iat" && key != "exp" }
    }

    var defaultHasuraRole: String? {
        hasuraClaims?["x-hasura-default-role"]?.stringValue
    }

    var stableClaimsFingerprint: String? {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        guard let claims = try? encoder.encode(stableAuthorizationClaims) else {
            return nil
        }
        var input = Data("nhost.session.claims.v1".utf8)
        var length = UInt64(claims.count).bigEndian
        withUnsafeBytes(of: &length) { input.append(contentsOf: $0) }
        input.append(claims)
        return NhostSHA256.hexadecimalDigest(input)
    }

    public static func decodeUserSession(_ accessToken: String) throws -> DecodedToken {
        let parts = accessToken.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 3, !parts[1].isEmpty else {
            throw NhostSessionError.invalidAccessTokenFormat
        }

        let payload = try decodeBase64URL(String(parts[1]))
        guard let decoded = try? JSONDecoder().decode(JSONValue.self, from: payload),
              case let .object(claims) = decoded
        else {
            throw NhostSessionError.invalidJSONPayload
        }

        return DecodedToken(claims: claims, datesAreJWTSeconds: true)
    }

    private static func decodeBase64URL(_ input: String) throws -> Data {
        var base64 = input.replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let padding = base64.count % 4

        if padding == 1 {
            throw NhostSessionError.invalidBase64URLPayload
        }

        if padding > 0 {
            base64.append(String(repeating: "=", count: 4 - padding))
        }

        guard let data = Data(base64Encoded: base64) else {
            throw NhostSessionError.invalidBase64URLPayload
        }

        return data
    }

    private static func normalizedClaims(
        _ claims: [String: JSONValue],
        datesAreJWTSeconds: Bool
    ) -> [String: JSONValue] {
        var normalized = claims

        for key in ["iat", "exp"] {
            guard case let .number(value) = normalized[key] else { continue }
            normalized[key] = .number(datesAreJWTSeconds ? value * 1_000 : value)
        }

        if case let .object(hasuraClaims) = normalized[hasuraClaimsKey] {
            normalized[hasuraClaimsKey] = .object(processHasuraClaims(hasuraClaims))
        }

        return normalized
    }

    private static func date(from value: JSONValue?, datesAreJWTSeconds: Bool) -> Date? {
        guard case let .number(timestamp) = value else { return nil }

        if datesAreJWTSeconds {
            return Date(timeIntervalSince1970: timestamp)
        }

        if timestamp > 10_000_000_000 {
            return Date(timeIntervalSince1970: timestamp / 1_000)
        }

        return Date(timeIntervalSince1970: timestamp)
    }

    private static func processHasuraClaims(_ claims: [String: JSONValue]) -> [String: JSONValue] {
        var processed = claims

        for (key, value) in claims {
            guard case let .string(string) = value, isPostgresArray(string) else { continue }
            processed[key] = .array(parsePostgresArray(string).map(JSONValue.string))
        }

        return processed
    }

    private static func isPostgresArray(_ value: String) -> Bool {
        value.hasPrefix("{") && value.hasSuffix("}")
    }

    private static func parsePostgresArray(_ value: String) -> [String] {
        guard value != "{}" else { return [] }

        let inner = value.dropFirst().dropLast()
        var items: [String] = []
        var current = ""
        var pendingUnquotedWhitespace = ""
        var isQuoted = false
        var isEscaping = false

        for character in inner {
            if isEscaping {
                appendPostgresArrayCharacter(
                    character,
                    preservingWhitespace: isQuoted,
                    current: &current,
                    pendingUnquotedWhitespace: &pendingUnquotedWhitespace
                )
                isEscaping = false
                continue
            }

            if character == "\\" {
                isEscaping = true
                continue
            }

            if character == "\"" {
                if !isQuoted {
                    if !current.isEmpty {
                        current.append(pendingUnquotedWhitespace)
                    }
                    pendingUnquotedWhitespace = ""
                }
                isQuoted.toggle()
                continue
            }

            if character == ",", !isQuoted {
                items.append(current)
                current = ""
                pendingUnquotedWhitespace = ""
                continue
            }

            appendPostgresArrayCharacter(
                character,
                preservingWhitespace: isQuoted,
                current: &current,
                pendingUnquotedWhitespace: &pendingUnquotedWhitespace
            )
        }

        items.append(current)
        return items
    }

    private static func appendPostgresArrayCharacter(
        _ character: Character,
        preservingWhitespace: Bool,
        current: inout String,
        pendingUnquotedWhitespace: inout String
    ) {
        guard preservingWhitespace || !character.isWhitespace else {
            pendingUnquotedWhitespace.append(character)
            return
        }

        if !current.isEmpty {
            current.append(pendingUnquotedWhitespace)
        }
        pendingUnquotedWhitespace = ""
        current.append(character)
    }
}

private struct DynamicCodingKey: CodingKey {
    let stringValue: String
    let intValue: Int?

    init?(stringValue: String) {
        self.stringValue = stringValue
        intValue = nil
    }

    init?(intValue: Int) {
        stringValue = String(intValue)
        self.intValue = intValue
    }
}
