import Foundation
import XCTest
@testable import Nhost

final class GeneratedProviderRedirectTests: XCTestCase {
    func testMetadataIsEncodedAsSingleJSONQueryItem() throws {
        let client = AuthClient(
            baseURL: try XCTUnwrap(URL(string: "https://auth.example.test"))
        )
        let metadata: [String: JSONValue] = [
            "profile": .object(["displayName": .string("Swift User")]),
            "source": .string("native app")
        ]
        let redirects = [
            try client.signInProviderURL(
                provider: .github,
                query: AuthSignInProviderQuery(metadata: metadata)
            ),
            try client.signUpProviderURL(
                provider: .github,
                query: AuthSignUpProviderQuery(metadata: metadata)
            )
        ]

        for redirect in redirects {
            let components = try XCTUnwrap(
                URLComponents(url: redirect, resolvingAgainstBaseURL: false)
            )
            let queryItems = components.queryItems ?? []
            let metadataItems = queryItems.filter { $0.name == "metadata" }

            XCTAssertEqual(queryItems.count, 1)
            XCTAssertEqual(metadataItems.count, 1)
            XCTAssertFalse(queryItems.contains { $0.name.hasPrefix("metadata[") })

            let metadataItem = try XCTUnwrap(metadataItems.first)
            let encodedMetadata = try XCTUnwrap(metadataItem.value)
            let decodedMetadata = try NhostJSON.restDecoder.decode(
                [String: JSONValue].self,
                from: Data(encodedMetadata.utf8)
            )
            XCTAssertEqual(decodedMetadata, metadata)
        }
    }
}
