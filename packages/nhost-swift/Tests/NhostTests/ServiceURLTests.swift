import XCTest
@testable import Nhost

final class ServiceURLTests: XCTestCase {
    func testFallsBackForIncompleteOrBlankProjectCoordinates() {
        let incompleteOrBlankCoordinates: [(subdomain: String?, region: String?)] = [
            (nil, nil),
            (nil, "eu-central-1"),
            ("proj", nil),
            ("", "eu-central-1"),
            ("proj", ""),
            ("", ""),
            (" \t", "eu-central-1"),
            ("proj", "\n"),
            (" \t", "\r\n")
        ]

        for service in NhostService.allCases {
            for coordinates in incompleteOrBlankCoordinates {
                XCTAssertEqual(
                    generateServiceURL(
                        service,
                        subdomain: coordinates.subdomain,
                        region: coordinates.region
                    ).absoluteString,
                    "https://local.\(service.rawValue).local.nhost.run/v1",
                    "Expected local fallback for subdomain \(String(describing: coordinates.subdomain)) "
                        + "and region \(String(describing: coordinates.region))"
                )
            }
        }
    }

    func testClientFactoryAppliesBlankCoordinateFallbackToEveryService() {
        let client = createNhostClient(
            NhostClientOptions(
                subdomain: "proj",
                region: " \n",
                sessionManagement: .processLocal(storage: MemorySessionStorageBackend())
            )
        )

        XCTAssertEqual(
            client.serviceURLs.auth.absoluteString,
            "https://local.auth.local.nhost.run/v1"
        )
        XCTAssertEqual(
            client.serviceURLs.storage.absoluteString,
            "https://local.storage.local.nhost.run/v1"
        )
        XCTAssertEqual(
            client.serviceURLs.graphql.absoluteString,
            "https://local.graphql.local.nhost.run/v1"
        )
        XCTAssertEqual(
            client.serviceURLs.functions.absoluteString,
            "https://local.functions.local.nhost.run/v1"
        )
    }
}
