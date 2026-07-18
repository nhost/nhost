import Foundation
import XCTest
@testable import Nhost

final class ManagedSessionMiddlewareTests: XCTestCase {

    func testGeneratedAuthOperationAuditIsExhaustiveAndUnique() throws {
        let source = try generatedAuthSource()
        let expression = try NSRegularExpression(pattern: #"public func ([A-Za-z0-9_]+)\("#)
        let range = NSRange(source.startIndex..., in: source)
        let generatedNames = Set<String>(expression.matches(in: source, range: range).compactMap { match in
            guard let range = Range(match.range(at: 1), in: source) else { return nil }
            return String(source[range])
        })
        let auditedNames = ManagedAuthOperationAudit.entries.map(\.operationID)

        XCTAssertEqual(Set(auditedNames), generatedNames)
        XCTAssertEqual(Set(auditedNames).count, auditedNames.count)
        XCTAssertEqual(generatedNames.count, 58)
    }

    func testOAuthProviderClassifierMatchesGeneratedProviderEnum() throws {
        let source = try generatedAuthSource()
        let declarationExpression = try NSRegularExpression(
            pattern: #"public enum AuthSignInProvider: String, Codable, Sendable \{([\s\S]*?)\}"#
        )
        let sourceRange = NSRange(source.startIndex..., in: source)
        let declarationMatch = try XCTUnwrap(
            declarationExpression.firstMatch(in: source, range: sourceRange),
            "AuthSignInProvider declaration is missing from generated Auth.swift"
        )
        let declarationRange = try XCTUnwrap(Range(declarationMatch.range(at: 1), in: source))
        let declaration = String(source[declarationRange])
        let caseExpression = try NSRegularExpression(pattern: #"case [A-Za-z0-9_]+ = \"([^\"]+)\""#)
        let caseRange = NSRange(declaration.startIndex..., in: declaration)
        let matches = caseExpression.matches(in: declaration, range: caseRange)
        let generatedProviders = Set<String>(matches.compactMap { match in
            guard let range = Range(match.range(at: 1), in: declaration) else { return nil }
            return String(declaration[range])
        })

        XCTAssertFalse(generatedProviders.isEmpty)
        XCTAssertEqual(ManagedAuthRequestClassifier.providers, generatedProviders)
    }

    func testEveryGeneratedRequestHasAnExactFourDimensionPolicyAndClassifies() throws {
        for entry in ManagedAuthOperationAudit.entries {
            guard let method = entry.method else {
                XCTAssertEqual(entry.path, .urlOnly, entry.operationID)
                continue
            }

            let relativePath: String
            switch entry.path {
            case let .exact(path):
                relativePath = path
            case .providerCallbackTokens:
                relativePath = "/signin/provider/github/callback/tokens"
            case .providerRefresh:
                relativePath = "/token/provider/github"
            case .urlOnly:
                XCTFail("HTTP operation unexpectedly marked URL-only: \(entry.operationID)")
                continue
            }

            let request = NhostRequest(
                method: method,
                url: NhostURLBuilder.join(baseURL: managedAuthTestBaseURL, path: relativePath)
            )
            XCTAssertEqual(
                auditedManagedAuthOperation(for: request, authBaseURL: managedAuthTestBaseURL)?.operationID,
                entry.operationID,
                entry.operationID
            )

            // Reading every field is intentional: additions cannot silently omit
            // any of the four policy dimensions.
            _ = entry.policy.proactiveRefresh
            _ = entry.policy.authorization
            _ = entry.policy.fullTransaction
            _ = entry.policy.outcomeMutation
        }
    }

    func testMandatoryProducerRecoveryAndAuthenticatedPolicies() {
        let producerIDs: Set<String> = [
            "tokenExchange", "signInAnonymous", "signInEmailPassword", "signInIdToken",
            "verifySignInMfaTotp", "verifySignInOTPEmail", "verifySignInPasswordlessSms",
            "signInPAT", "verifySignInWebauthn", "signUpEmailPassword", "verifySignUpWebauthn",
            "signUpIdToken",
        ]
        let recoveryIDs: Set<String> = [
            "signInOTPEmail", "signInPasswordlessEmail", "signInPasswordlessSms", "signInWebauthn",
            "signUpPasswordlessEmail", "signUpOTPEmail", "signUpPasswordlessSms", "signUpWebauthn",
            "sendPasswordResetEmail",
        ]

        for entry in ManagedAuthOperationAudit.entries where producerIDs.contains(entry.operationID) {
            XCTAssertEqual(entry.policy, .sessionProducer, entry.operationID)
        }
        for entry in ManagedAuthOperationAudit.entries where recoveryIDs.contains(entry.operationID) {
            XCTAssertEqual(entry.policy, .sessionless, entry.operationID)
        }
        XCTAssertEqual(managedPolicy("verifyElevateWebauthn"), .elevatedSessionProducer)
        XCTAssertEqual(managedPolicy("elevateWebauthn"), .authenticatedOrdinary)
        XCTAssertEqual(managedPolicy("refreshToken"), .directRefresh)
        XCTAssertEqual(managedPolicy("signOut"), .signOut)
        XCTAssertEqual(managedPolicy("changeUserPassword"), .passwordChange)
    }

    func testClassifierRejectsDeceptiveOriginBasePathMethodAndPathSpellings() throws {
        let classified = NhostRequest(method: "POST", url: URL(string: "https://auth.example.test/v1/token?x=1")!)
        XCTAssertEqual(
            auditedManagedAuthOperation(for: classified, authBaseURL: managedAuthTestBaseURL)?.operationID,
            "refreshToken"
        )

        let deceptive: [(String, String)] = [
            ("GET", "https://auth.example.test/v1/token"),
            ("POST", "https://auth.example.test.evil/v1/token"),
            ("POST", "https://evil.example.test/v1/token"),
            ("POST", "https://user@auth.example.test/v1/token"),
            ("POST", "http://auth.example.test/v1/token"),
            ("POST", "https://auth.example.test/v11/token"),
            ("POST", "https://auth.example.test/v1/token/"),
            ("POST", "https://auth.example.test/v1/%74oken"),
            ("POST", "https://auth.example.test/v1/other/../token"),
            ("POST", "https://auth.example.test/v1/%2e/token"),
            ("POST", "https://auth.example.test/v1/tokenize"),
            ("POST", "https://auth.example.test/v1/mytoken"),
            ("POST", "https://auth.example.test/v1//token"),
        ]

        for (method, urlString) in deceptive {
            let request = NhostRequest(method: method, url: try XCTUnwrap(URL(string: urlString)))
            XCTAssertNil(
                auditedManagedAuthOperation(for: request, authBaseURL: managedAuthTestBaseURL),
                urlString
            )
        }

        let nestedBase = try XCTUnwrap(URL(string: "https://auth.example.test/custom/auth/"))
        let exactNested = NhostRequest(
            method: "POST",
            url: try XCTUnwrap(URL(string: "https://auth.example.test/custom/auth/token"))
        )
        let lookalikeNested = NhostRequest(
            method: "POST",
            url: try XCTUnwrap(URL(string: "https://auth.example.test/custom/authentic/token"))
        )
        XCTAssertEqual(
            auditedManagedAuthOperation(for: exactNested, authBaseURL: nestedBase)?.operationID,
            "refreshToken"
        )
        XCTAssertNil(auditedManagedAuthOperation(for: lookalikeNested, authBaseURL: nestedBase))
    }

    private func generatedAuthSource() throws -> String {
        let testDirectory = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        let generatedFile = testDirectory
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Sources/Nhost/Generated/Auth.swift")
        return try String(contentsOf: generatedFile, encoding: .utf8)
    }

    func testRecoveryEndpointsBypassBrokenStorageAndCoordination() async throws {
        let backend = FaultInjectingSessionBackend(getFailure: .storageRead)
        let store = SessionStore(storage: backend, coordinator: AlwaysFailingManagedCoordinator())
        let transport = ManagedRecordingTransport { _ in NhostRawResponse(status: 200, body: Data(#"{"ok":true}"#.utf8)) }
        let pipeline = makeManagedPipeline(store: store, transport: transport)
        let recoveryPaths = [
            "/signin/otp/email", "/signin/passwordless/email", "/signin/passwordless/sms",
            "/signin/webauthn", "/signup/passwordless/email", "/signup/otp/email",
            "/signup/passwordless/sms", "/signup/webauthn", "/user/password/reset",
        ]

        for path in recoveryPaths {
            _ = try await pipeline.send(
                NhostRequest(method: "POST", url: NhostURLBuilder.join(baseURL: managedAuthTestBaseURL, path: path))
            )
        }
        let requests = await transport.requests()
        XCTAssertEqual(requests.count, recoveryPaths.count)
    }

}
