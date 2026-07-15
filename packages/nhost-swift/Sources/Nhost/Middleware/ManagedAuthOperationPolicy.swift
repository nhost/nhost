import Foundation

enum ManagedAuthOutcomeMutation: String, Sendable, Equatable {
    case none
    case persistSession
    case persistDirectRefresh
    case clearSession
}

struct ManagedAuthOperationPolicy: Sendable, Equatable {
    let proactiveRefresh: Bool
    let authorization: Bool
    let fullTransaction: Bool
    let outcomeMutation: ManagedAuthOutcomeMutation

    static let sessionless = ManagedAuthOperationPolicy(
        proactiveRefresh: false,
        authorization: false,
        fullTransaction: false,
        outcomeMutation: .none
    )
    static let authenticatedOrdinary = ManagedAuthOperationPolicy(
        proactiveRefresh: true,
        authorization: true,
        fullTransaction: false,
        outcomeMutation: .none
    )
    static let sessionProducer = ManagedAuthOperationPolicy(
        proactiveRefresh: false,
        authorization: false,
        fullTransaction: true,
        outcomeMutation: .persistSession
    )
    static let elevatedSessionProducer = ManagedAuthOperationPolicy(
        proactiveRefresh: true,
        authorization: true,
        fullTransaction: true,
        outcomeMutation: .persistSession
    )
    static let directRefresh = ManagedAuthOperationPolicy(
        proactiveRefresh: false,
        authorization: false,
        fullTransaction: true,
        outcomeMutation: .persistDirectRefresh
    )
    static let signOut = ManagedAuthOperationPolicy(
        proactiveRefresh: false,
        authorization: true,
        fullTransaction: true,
        outcomeMutation: .clearSession
    )
    static let passwordChange = ManagedAuthOperationPolicy(
        proactiveRefresh: true,
        authorization: true,
        fullTransaction: true,
        outcomeMutation: .clearSession
    )
}

enum ManagedAuthPath: Sendable, Equatable {
    case exact(String)
    case providerCallbackTokens
    case providerRefresh
    case urlOnly
}

/// Exhaustive audit of every public operation emitted by Generated/Auth.swift.
/// URL-only redirect builders are included even though they never enter HTTP middleware.
struct ManagedAuthOperationAudit: Sendable, Equatable {
    let operationID: String
    let method: String?
    let path: ManagedAuthPath
    let policy: ManagedAuthOperationPolicy

    static let entries: [ManagedAuthOperationAudit] = [
        request("getJWKs", "GET", "/.well-known/jwks.json", .sessionless),
        request("elevateWebauthn", "POST", "/elevate/webauthn", .authenticatedOrdinary),
        request("verifyElevateWebauthn", "POST", "/elevate/webauthn/verify", .elevatedSessionProducer),
        request("healthCheckGet", "GET", "/healthz", .sessionless),
        request("healthCheckHead", "HEAD", "/healthz", .sessionless),
        request("linkIdToken", "POST", "/link/idtoken", .authenticatedOrdinary),
        request("changeUserMfa", "GET", "/mfa/totp/generate", .authenticatedOrdinary),
        request("createPAT", "POST", "/pat", .authenticatedOrdinary),
        request("signInAnonymous", "POST", "/signin/anonymous", .sessionProducer),
        request("signInEmailPassword", "POST", "/signin/email-password", .sessionProducer),
        request("signInIdToken", "POST", "/signin/idtoken", .sessionProducer),
        request("verifySignInMfaTotp", "POST", "/signin/mfa/totp", .sessionProducer),
        request("signInOTPEmail", "POST", "/signin/otp/email", .sessionless),
        request("verifySignInOTPEmail", "POST", "/signin/otp/email/verify", .sessionProducer),
        request("signInPasswordlessEmail", "POST", "/signin/passwordless/email", .sessionless),
        request("signInPasswordlessSms", "POST", "/signin/passwordless/sms", .sessionless),
        request("verifySignInPasswordlessSms", "POST", "/signin/passwordless/sms/otp", .sessionProducer),
        request("signInPAT", "POST", "/signin/pat", .sessionProducer),
        urlOnly("signInProviderURL"),
        dynamicRequest("getProviderTokens", "GET", .providerCallbackTokens, .authenticatedOrdinary),
        request("signInWebauthn", "POST", "/signin/webauthn", .sessionless),
        request("verifySignInWebauthn", "POST", "/signin/webauthn/verify", .sessionProducer),
        request("signOut", "POST", "/signout", .signOut),
        request("signUpEmailPassword", "POST", "/signup/email-password", .sessionProducer),
        request("signUpWebauthn", "POST", "/signup/webauthn", .sessionless),
        request("verifySignUpWebauthn", "POST", "/signup/webauthn/verify", .sessionProducer),
        request("signUpPasswordlessEmail", "POST", "/signup/passwordless/email", .sessionless),
        request("signUpOTPEmail", "POST", "/signup/otp/email", .sessionless),
        request("signUpPasswordlessSms", "POST", "/signup/passwordless/sms", .sessionless),
        request("signUpIdToken", "POST", "/signup/idtoken", .sessionProducer),
        urlOnly("signUpProviderURL"),
        request("refreshToken", "POST", "/token", .directRefresh),
        dynamicRequest("refreshProviderToken", "POST", .providerRefresh, .authenticatedOrdinary),
        request("verifyToken", "POST", "/token/verify", .authenticatedOrdinary),
        request("getUser", "GET", "/user", .authenticatedOrdinary),
        request("deanonymizeUser", "POST", "/user/deanonymize", .authenticatedOrdinary),
        request("changeUserEmail", "POST", "/user/email/change", .authenticatedOrdinary),
        request("sendVerificationEmail", "POST", "/user/email/send-verification-email", .sessionless),
        request("verifyChangeUserMfa", "POST", "/user/mfa", .authenticatedOrdinary),
        request("changeUserPassword", "POST", "/user/password", .passwordChange),
        request("sendPasswordResetEmail", "POST", "/user/password/reset", .sessionless),
        request("addSecurityKey", "POST", "/user/webauthn/add", .authenticatedOrdinary),
        request("verifyAddSecurityKey", "POST", "/user/webauthn/verify", .authenticatedOrdinary),
        request("tokenExchange", "POST", "/token/exchange", .sessionProducer),
        urlOnly("verifyTicketURL"),
        request("getVersion", "GET", "/version", .sessionless),
        request("getOpenIDConfiguration", "GET", "/.well-known/openid-configuration", .sessionless),
        request("getOAuthAuthorizationServer", "GET", "/.well-known/oauth-authorization-server", .sessionless),
        urlOnly("oauth2AuthorizeURL"),
        urlOnly("oauth2AuthorizePostURL"),
        request("oauth2Token", "POST", "/oauth2/token", .sessionless),
        request("oauth2UserinfoGet", "GET", "/oauth2/userinfo", .authenticatedOrdinary),
        request("oauth2UserinfoPost", "POST", "/oauth2/userinfo", .authenticatedOrdinary),
        request("oauth2Jwks", "GET", "/oauth2/jwks", .sessionless),
        request("oauth2Revoke", "POST", "/oauth2/revoke", .sessionless),
        request("oauth2Introspect", "POST", "/oauth2/introspect", .sessionless),
        request("oauth2LoginGet", "GET", "/oauth2/login", .sessionless),
        request("oauth2LoginPost", "POST", "/oauth2/login", .authenticatedOrdinary),
    ]

    private static func request(
        _ operationID: String,
        _ method: String,
        _ path: String,
        _ policy: ManagedAuthOperationPolicy
    ) -> ManagedAuthOperationAudit {
        ManagedAuthOperationAudit(operationID: operationID, method: method, path: .exact(path), policy: policy)
    }

    private static func dynamicRequest(
        _ operationID: String,
        _ method: String,
        _ path: ManagedAuthPath,
        _ policy: ManagedAuthOperationPolicy
    ) -> ManagedAuthOperationAudit {
        ManagedAuthOperationAudit(operationID: operationID, method: method, path: path, policy: policy)
    }

    private static func urlOnly(_ operationID: String) -> ManagedAuthOperationAudit {
        ManagedAuthOperationAudit(operationID: operationID, method: nil, path: .urlOnly, policy: .sessionless)
    }
}
