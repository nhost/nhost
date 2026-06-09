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
}
