import Foundation

/// Client-side session persisted by the SDK.
///
/// This enriches the generated Auth session with the decoded access-token payload.
public struct StoredSession: Codable, Sendable {
    /// JWT token for authenticating API requests.
    public let accessToken: String
    /// Expiration time of the access token in seconds, as returned by Auth.
    public let accessTokenExpiresIn: Int
    /// Identifier for the refresh token.
    public let refreshTokenId: String
    /// Token used to refresh the access token.
    public let refreshToken: String
    /// User profile and account information.
    public let user: AuthUser?
    /// Decoded JWT payload for Hasura claims, roles, and expiration checks.
    public let decodedToken: DecodedToken

    public init(
        accessToken: String,
        accessTokenExpiresIn: Int,
        refreshTokenId: String,
        refreshToken: String,
        user: AuthUser? = nil,
        decodedToken: DecodedToken? = nil
    ) throws {
        self.accessToken = accessToken
        self.accessTokenExpiresIn = accessTokenExpiresIn
        self.refreshTokenId = refreshTokenId
        self.refreshToken = refreshToken
        self.user = user
        if let decodedToken {
            self.decodedToken = decodedToken
        } else {
            self.decodedToken = try DecodedToken.decodeUserSession(accessToken)
        }
    }

    public init(_ session: AuthSession) throws {
        try self.init(
            accessToken: session.accessToken,
            accessTokenExpiresIn: session.accessTokenExpiresIn,
            refreshTokenId: session.refreshTokenId,
            refreshToken: session.refreshToken,
            user: session.user
        )
    }

    public var authSession: AuthSession {
        AuthSession(
            accessToken: accessToken,
            accessTokenExpiresIn: accessTokenExpiresIn,
            refreshTokenId: refreshTokenId,
            refreshToken: refreshToken,
            user: user
        )
    }

    /// Stable authorization material used by session snapshots and GraphQL
    /// cache scopes. Access/refresh token bytes and volatile JWT lifetime claims
    /// are intentionally excluded.
    var stableAuthorizationFingerprint: String {
        var input = Data("nhost.session.authorization.v1".utf8)
        Self.appendFrame(Data((user?.id ?? "").utf8), to: &input)
        Self.appendFrame(Data((decodedToken.issuer ?? "").utf8), to: &input)
        Self.appendFrame(Data((decodedToken.subject ?? "").utf8), to: &input)

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        if let claims = try? encoder.encode(decodedToken.stableAuthorizationClaims) {
            Self.appendFrame(claims, to: &input)
        } else {
            // JWT JSON cannot contain non-finite values. A manually-created
            // DecodedToken that does falls back to the token digest, preserving
            // isolation even though refresh-stable reuse is unavailable.
            Self.appendFrame(Data(accessToken.utf8), to: &input)
        }

        return NhostSHA256.hexadecimalDigest(input)
    }

    var stableClaimsFingerprint: String {
        decodedToken.stableClaimsFingerprint
            ?? NhostSHA256.hexadecimalDigest(Data(accessToken.utf8))
    }

    var stableUserIdentity: String? {
        let components = [user?.id, decodedToken.subject, decodedToken.issuer]
            .compactMap { $0 }
        return components.isEmpty ? nil : components.joined(separator: "\u{1f}")
    }

    private static func appendFrame(_ data: Data, to output: inout Data) {
        var length = UInt64(data.count).bigEndian
        withUnsafeBytes(of: &length) { output.append(contentsOf: $0) }
        output.append(data)
    }
}
