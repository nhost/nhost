import Foundation
import XCTest
@testable import Nhost

final class PKCETests: XCTestCase {
    func testCodeVerifierShapeAndUniqueness() {
        let first = PKCE.generateCodeVerifier()
        let second = PKCE.generateCodeVerifier()

        // 32 random bytes -> 43 unpadded base64url characters, like nhost-js.
        XCTAssertEqual(first.count, 43)
        XCTAssertNotEqual(first, second)

        let allowed = CharacterSet(
            charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
        )
        XCTAssertTrue(first.unicodeScalars.allSatisfy { allowed.contains($0) })
    }

    func testCodeChallengeMatchesRFC7636AppendixB() {
        // https://www.rfc-editor.org/rfc/rfc7636#appendix-B
        XCTAssertEqual(
            PKCE.generateCodeChallenge(from: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        )
    }

    func testGeneratePairIsSelfConsistent() {
        let pair = PKCE.generatePair()

        XCTAssertEqual(pair.challenge, PKCE.generateCodeChallenge(from: pair.verifier))
    }

    func testPureSwiftSHA256MatchesKnownVectors() {
        XCTAssertEqual(
            PureSwiftSHA256.hash(Data()).map { String(format: "%02x", $0) }.joined(),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        )
        XCTAssertEqual(
            PureSwiftSHA256.hash(Data("abc".utf8)).map { String(format: "%02x", $0) }.joined(),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        )

        // Multi-block input (> 64 bytes) exercises the chunk loop.
        let longInput = Data(String(repeating: "a", count: 200).utf8)
        XCTAssertEqual(
            PureSwiftSHA256.hash(longInput).map { String(format: "%02x", $0) }.joined(),
            "c2a908d98f5df987ade41b5fce213067efbcc21ef2240212a41e54b5e7c28ae5"
        )

        #if canImport(CryptoKit)
        // On Apple platforms, cross-check the Linux fallback against CryptoKit.
        for sample in ["", "abc", "nhost", String(repeating: "x", count: 1000)] {
            XCTAssertEqual(
                PureSwiftSHA256.hash(Data(sample.utf8)),
                NhostSHA256.hash(Data(sample.utf8)),
                "fallback SHA-256 diverges from CryptoKit for \(sample.prefix(10))"
            )
        }
        #endif
    }
}
