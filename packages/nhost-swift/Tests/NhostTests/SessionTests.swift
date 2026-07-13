import Foundation
import XCTest
@testable import Nhost

let testNowSeconds = 1_700_000_000

func testAccessToken(
    exp: Int = testNowSeconds + 3_600,
    iat: Int = testNowSeconds,
    subject: String = "user-1",
    hasuraClaims: [String: Any] = [
        "x-hasura-default-role": "user",
        "x-hasura-allowed-roles": "{user,editor}"
    ]
) throws -> String {
    let header = try base64URLEncodeJSONObject(["alg": "none", "typ": "JWT"])
    let payload = try base64URLEncodeJSONObject([
        "exp": exp,
        "iat": iat,
        "iss": "nhost-tests",
        "sub": subject,
        DecodedToken.hasuraClaimsKey: hasuraClaims
    ])

    return "\(header).\(payload).signature"
}

private func base64URLEncodeJSONObject(_ object: [String: Any]) throws -> String {
    let data = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
    return base64URLEncode(data)
}

private func base64URLEncode(_ data: Data) -> String {
    data.base64EncodedString()
        .replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_")
        .replacingOccurrences(of: "=", with: "")
}

func testAuthSession(
    exp: Int = testNowSeconds + 3_600,
    accessToken: String? = nil,
    refreshToken: String = "refresh-token",
    refreshTokenId: String = "refresh-token-id"
) throws -> AuthSession {
    let token: String
    if let accessToken {
        token = accessToken
    } else {
        token = try testAccessToken(exp: exp)
    }

    return AuthSession(
        accessToken: token,
        accessTokenExpiresIn: max(exp - testNowSeconds, 0),
        refreshTokenId: refreshTokenId,
        refreshToken: refreshToken,
        user: nil
    )
}

private actor SessionChangeRecorder {
    private var values: [String?] = []

    func append(_ session: StoredSession?) {
        values.append(session?.accessToken)
    }

    func snapshot() -> [String?] {
        values
    }
}

private actor SessionTransitionRecorder {
    private var values: [(String?, String?)] = []

    func append(old: StoredSession?, new: StoredSession?) {
        values.append((old?.decodedToken.subject, new?.decodedToken.subject))
    }

    func snapshot() -> [(String?, String?)] {
        values
    }
}

private actor CustomStorageBox {
    private var session: StoredSession?

    func get() -> StoredSession? {
        session
    }

    func set(_ value: StoredSession) {
        session = value
    }

    func remove() {
        session = nil
    }
}

final class DecodedTokenTests: XCTestCase {
    func testDecodesJWTAndProcessesHasuraClaims() throws {
        let token = try testAccessToken(
            hasuraClaims: [
                "x-hasura-default-role": "user",
                "x-hasura-allowed-roles": "{user,editor}",
                "x-hasura-groups": "{\"team-a\",\"team,b\"}"
            ]
        )

        let decoded = try DecodedToken.decodeUserSession(token)

        XCTAssertEqual(decoded.issuer, "nhost-tests")
        XCTAssertEqual(decoded.subject, "user-1")
        XCTAssertEqual(decoded.exp?.timeIntervalSince1970, TimeInterval(testNowSeconds + 3_600))
        XCTAssertEqual(decoded.iat?.timeIntervalSince1970, TimeInterval(testNowSeconds))
        XCTAssertEqual(decoded.claims["exp"], .number(Double(testNowSeconds + 3_600) * 1_000))
        XCTAssertEqual(decoded.hasuraClaims?["x-hasura-default-role"], .string("user"))
        XCTAssertEqual(
            decoded.hasuraClaims?["x-hasura-allowed-roles"],
            .array([.string("user"), .string("editor")])
        )
        XCTAssertEqual(
            decoded.hasuraClaims?["x-hasura-groups"],
            .array([.string("team-a"), .string("team,b")])
        )
    }

    func testMalformedJWTThrows() {
        XCTAssertThrowsError(try DecodedToken.decodeUserSession("not-a-jwt")) { error in
            XCTAssertEqual(error as? NhostSessionError, .invalidAccessTokenFormat)
        }

        XCTAssertThrowsError(try DecodedToken.decodeUserSession("a.%%%%.c"))
    }
}

final class SessionStoreTests: XCTestCase {
    func testMemoryStorageAndSubscriptions() async throws {
        let store = SessionStore(storage: MemorySessionStorageBackend())
        let recorder = SessionChangeRecorder()
        let subscription = await store.subscribe { session in
            await recorder.append(session)
        }
        let first = try testAuthSession(accessToken: testAccessToken(exp: testNowSeconds + 60))

        let stored = try await store.set(first)
        let storedRefreshToken = try await store.get()?.refreshToken
        XCTAssertEqual(stored.accessToken, first.accessToken)
        XCTAssertEqual(storedRefreshToken, "refresh-token")

        try await store.remove()
        let removedSession = try await store.get()
        let firstChanges = await recorder.snapshot()
        XCTAssertNil(removedSession)
        XCTAssertEqual(firstChanges, [first.accessToken, nil])

        await subscription.cancel()
        _ = try await store.set(try testAuthSession(accessToken: testAccessToken(exp: testNowSeconds + 120)))
        let changesAfterCancel = await recorder.snapshot()
        XCTAssertEqual(changesAfterCancel, [first.accessToken, nil])
    }

    func testAuthorizationSnapshotsTrackGenerationsEpochsAndStableRefreshes() async throws {
        let initial = try StoredSession(
            try testAuthSession(
                accessToken: testAccessToken(exp: testNowSeconds + 60, iat: testNowSeconds)
            )
        )
        let backend = MemorySessionStorageBackend(session: initial)
        let store = SessionStore(storage: backend)

        let first = try await store.authorizationSnapshot()
        XCTAssertEqual(first.mutationGeneration, 0)
        XCTAssertEqual(first.authorizationEpoch, 0)
        XCTAssertEqual(first.session?.decodedToken.subject, "user-1")

        let refreshed = try StoredSession(
            try testAuthSession(
                exp: testNowSeconds + 3_600,
                accessToken: testAccessToken(exp: testNowSeconds + 3_600, iat: testNowSeconds + 30)
            )
        )
        _ = try await store.set(refreshed)
        let afterRefresh = try await store.authorizationSnapshot()
        XCTAssertEqual(afterRefresh.mutationGeneration, 1)
        XCTAssertEqual(afterRefresh.authorizationEpoch, 0)
        XCTAssertEqual(afterRefresh.stableFingerprint, first.stableFingerprint)

        let otherUser = try StoredSession(
            try testAuthSession(
                accessToken: testAccessToken(subject: "user-2")
            )
        )
        _ = try await store.set(otherUser)
        let afterUserSwitch = try await store.authorizationSnapshot()
        XCTAssertEqual(afterUserSwitch.mutationGeneration, 2)
        XCTAssertEqual(afterUserSwitch.authorizationEpoch, 1)
        XCTAssertNotEqual(afterUserSwitch.stableFingerprint, first.stableFingerprint)

        _ = try await store.set(refreshed)
        let afterABA = try await store.authorizationSnapshot()
        XCTAssertEqual(afterABA.mutationGeneration, 3)
        XCTAssertEqual(afterABA.authorizationEpoch, 2)
        XCTAssertEqual(afterABA.stableFingerprint, first.stableFingerprint)
    }

    func testAuthorizationSnapshotRereadsCustomBackendChanges() async throws {
        let initial = try StoredSession(try testAuthSession())
        let replacement = try StoredSession(
            try testAuthSession(accessToken: testAccessToken(subject: "external-user"))
        )
        let backend = MemorySessionStorageBackend(session: initial)
        let store = SessionStore(storage: backend)

        let first = try await store.authorizationSnapshot()
        try await backend.set(replacement)
        let second = try await store.authorizationSnapshot()

        XCTAssertEqual(second.mutationGeneration, 0)
        XCTAssertEqual(second.authorizationEpoch, first.authorizationEpoch + 1)
        XCTAssertEqual(second.session?.decodedToken.subject, "external-user")
    }

    func testInternalTransitionObservationIncludesOldAndNewSessions() async throws {
        let initial = try StoredSession(try testAuthSession())
        let backend = MemorySessionStorageBackend(session: initial)
        let store = SessionStore(storage: backend)
        _ = try await store.authorizationSnapshot()
        let recorder = SessionTransitionRecorder()
        let subscription = await store.subscribeToTransitions { old, new in
            await recorder.append(old: old, new: new)
        }
        let replacement = try StoredSession(
            try testAuthSession(accessToken: testAccessToken(subject: "user-2"))
        )

        _ = try await store.set(replacement)
        try await store.remove()
        let transitions = await recorder.snapshot()

        XCTAssertEqual(transitions.count, 2)
        XCTAssertEqual(transitions[0].0, "user-1")
        XCTAssertEqual(transitions[0].1, "user-2")
        XCTAssertEqual(transitions[1].0, "user-2")
        XCTAssertNil(transitions[1].1)
        await subscription.cancel()
    }

    func testCustomStorageBackend() async throws {
        let box = CustomStorageBox()
        let backend = CustomSessionStorageBackend(
            get: { await box.get() },
            set: { await box.set($0) },
            remove: { await box.remove() }
        )
        let store = SessionStore(storage: backend)
        let session = try StoredSession(try testAuthSession())

        _ = try await store.set(session)
        let storedAccessToken = try await store.get()?.accessToken
        XCTAssertEqual(storedAccessToken, session.accessToken)

        try await store.remove()
        let removedSession = try await store.get()
        XCTAssertNil(removedSession)
    }

    #if canImport(Security)
    // The ad hoc signed `swift test` runner has no application-identifier
    // entitlement, so these tests must opt out of the macOS data-protection
    // keychain that the backend uses by default.
    private static func testKeychainOptions() -> KeychainSessionStorageOptions {
        KeychainSessionStorageOptions(
            service: "io.nhost.swift.tests.\(UUID().uuidString)",
            accountPrefix: "phase6",
            useDataProtectionKeychain: false
        )
    }

    func testKeychainStorageRoundTripWhenExplicitlyEnabled() async throws {
        guard ProcessInfo.processInfo.environment["NHOST_SWIFT_RUN_KEYCHAIN_TESTS"] == "1" else {
            throw XCTSkip("Set NHOST_SWIFT_RUN_KEYCHAIN_TESTS=1 to run Keychain-specific tests")
        }

        let backend = KeychainSessionStorageBackend(options: Self.testKeychainOptions())
        let session = try StoredSession(try testAuthSession())

        try? await backend.remove()
        try await backend.set(session)
        let storedAccessToken = try await backend.get()?.accessToken
        XCTAssertEqual(storedAccessToken, session.accessToken)
        try await backend.remove()
        let removedSession = try await backend.get()
        XCTAssertNil(removedSession)
    }

    func testKeychainStorageSelfHealsCorruptedEntriesWhenExplicitlyEnabled() async throws {
        guard ProcessInfo.processInfo.environment["NHOST_SWIFT_RUN_KEYCHAIN_TESTS"] == "1" else {
            throw XCTSkip("Set NHOST_SWIFT_RUN_KEYCHAIN_TESTS=1 to run Keychain-specific tests")
        }

        let options = Self.testKeychainOptions()
        let backend = KeychainSessionStorageBackend(options: options)

        try? await backend.remove()
        let corrupted: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: options.service,
            kSecAttrAccount as String: options.account,
            kSecValueData as String: Data("not a session".utf8)
        ]
        XCTAssertEqual(SecItemAdd(corrupted as CFDictionary, nil), errSecSuccess)

        // A corrupted entry is removed and reported as "no session" instead of
        // throwing forever (js storage-backend parity).
        let healed = try await backend.get()
        XCTAssertNil(healed)

        let session = try StoredSession(try testAuthSession())
        try await backend.set(session)
        let storedAccessToken = try await backend.get()?.accessToken
        XCTAssertEqual(storedAccessToken, session.accessToken)
        try await backend.remove()
    }
    #else
    func testDefaultStorageFallsBackToMemoryWhenKeychainUnavailable() {
        XCTAssertTrue(defaultSessionStorageBackend() is MemorySessionStorageBackend)
    }
    #endif
}
