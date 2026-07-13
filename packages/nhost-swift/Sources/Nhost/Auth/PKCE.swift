import Foundation

/// PKCE (Proof Key for Code Exchange) helpers for RFC 7636, mirroring nhost-js's
/// `generateCodeVerifier` / `generateCodeChallenge` / `generatePKCEPair`. Output is
/// byte-compatible with the JavaScript SDK: base64url without padding.
public enum PKCE {
    /// Generates a cryptographically random code verifier (43 base64url characters).
    public static func generateCodeVerifier() -> String {
        var generator = SystemRandomNumberGenerator()
        let bytes = (0..<32).map { _ in UInt8.random(in: .min ... .max, using: &generator) }

        return base64url(Data(bytes))
    }

    /// Derives the S256 code challenge from a code verifier.
    public static func generateCodeChallenge(from verifier: String) -> String {
        base64url(NhostSHA256.hash(Data(verifier.utf8)))
    }

    /// Generates a code verifier and its S256 challenge in one call.
    public static func generatePair() -> (verifier: String, challenge: String) {
        let verifier = generateCodeVerifier()

        return (verifier: verifier, challenge: generateCodeChallenge(from: verifier))
    }

    static func base64url(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
