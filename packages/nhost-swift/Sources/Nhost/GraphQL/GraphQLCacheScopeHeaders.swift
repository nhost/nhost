import Foundation

enum GraphQLAuthorizationExpectation: Sendable {
    case absent
    case exact(String)
    case managedClaims(String)

    func managedDefaultRole(from value: String?) -> String? {
        guard case .managedClaims = self, let value, let token = Self.bearerToken(from: value),
              let decoded = try? DecodedToken.decodeUserSession(token)
        else {
            return nil
        }
        return decoded.defaultHasuraRole
    }

    func matches(_ value: String?) -> Bool {
        switch self {
        case .absent:
            return value == nil
        case let .exact(expected):
            return value == expected
        case let .managedClaims(expectedFingerprint):
            guard let value, let token = Self.bearerToken(from: value),
                  let decoded = try? DecodedToken.decodeUserSession(token)
            else {
                return false
            }
            return decoded.stableClaimsFingerprint == expectedFingerprint
        }
    }

    private static func bearerToken(from value: String) -> String? {
        let parts = value.split(separator: " ", maxSplits: 1, omittingEmptySubsequences: true)
        guard parts.count == 2, parts[0].lowercased() == "bearer", !parts[1].isEmpty else {
            return nil
        }
        return String(parts[1])
    }
}

struct GraphQLScopeDigestInputs {
    let authorizationMode: GraphQLCacheSDKScope.AuthorizationMode
    let sessionFingerprint: String?
    let explicitAuthorization: String?
    let adminSecret: String?
    let effectiveRole: String?
    let protectedHeaders: [String: String]
}

enum GraphQLProtectedHeaders {
    static let nonVaryHeaderNames: Set<String> = ["accept", "content-type", "content-length"]

    static func normalized(_ headers: [String: String]) throws -> [String: String] {
        var normalized: [String: String] = [:]
        for (name, value) in headers {
            let lowercasedName = name.lowercased()
            if let existing = normalized[lowercasedName], existing != value {
                throw GraphQLCacheError.unavailableScope
            }
            normalized[lowercasedName] = value
        }
        return normalized
    }

    static func setIfAbsent(_ name: String, value: String, on headers: inout [String: String]) {
        let name = name.lowercased()
        if headers[name] == nil {
            headers[name] = value
        }
    }

    static func augmentedScopeDigest(
        base: GraphQLCacheDigest,
        customIdentifier: String,
        customHeaders: [String: String]
    ) -> GraphQLCacheDigest {
        var input = Data("nhost.graphql.authorization-scope.custom.v1".utf8)
        appendFrame(Data(base.rawValue.utf8), to: &input)
        appendFrame(Data(customIdentifier.utf8), to: &input)
        appendHeaders(customHeaders, to: &input)
        return GraphQLCacheDigest(rawValue: NhostSHA256.hexadecimalDigest(input))
    }

    static func scopeDigest(_ inputs: GraphQLScopeDigestInputs) -> GraphQLCacheDigest {
        var input = Data("nhost.graphql.authorization-scope.v1".utf8)
        appendFrame(Data(authorizationModeValue(inputs.authorizationMode).utf8), to: &input)
        for value in [
            inputs.sessionFingerprint,
            inputs.explicitAuthorization,
            inputs.adminSecret,
            inputs.effectiveRole
        ] {
            appendOptional(value, to: &input)
        }
        appendHeaders(inputs.protectedHeaders, to: &input)
        return GraphQLCacheDigest(rawValue: NhostSHA256.hexadecimalDigest(input))
    }

    private static func authorizationModeValue(
        _ mode: GraphQLCacheSDKScope.AuthorizationMode
    ) -> String {
        switch mode {
        case .anonymous: "anonymous"
        case .managedSession: "managed-session"
        case .explicitAuthorization: "explicit-authorization"
        case .admin: "admin"
        }
    }

    private static func appendHeaders(_ headers: [String: String], to output: inout Data) {
        for name in headers.keys.sorted() {
            appendFrame(Data(name.utf8), to: &output)
            appendFrame(Data((headers[name] ?? "").utf8), to: &output)
        }
    }

    private static func appendOptional(_ value: String?, to output: inout Data) {
        guard let value else {
            output.append(0)
            return
        }
        output.append(1)
        appendFrame(Data(value.utf8), to: &output)
    }

    private static func appendFrame(_ data: Data, to output: inout Data) {
        var length = UInt64(data.count).bigEndian
        withUnsafeBytes(of: &length) { output.append(contentsOf: $0) }
        output.append(data)
    }
}
