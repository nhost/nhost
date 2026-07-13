import Foundation
import XCTest
@testable import Nhost

class GraphQLCacheStoreTestCase: XCTestCase {
    func fileConfiguration(
        directory: URL,
        maximumTotalBytes: Int = 1_024,
        maximumEntryBytes: Int = 512,
        maximumEntries: Int = 100,
        fileProtection: GraphQLCacheFileProtection = .none
    ) -> GraphQLCacheConfiguration {
        GraphQLCacheConfiguration(
            maximumTotalBytes: maximumTotalBytes,
            maximumEntryBytes: maximumEntryBytes,
            maximumEntries: maximumEntries,
            directoryURL: directory,
            fileProtection: fileProtection
        )
    }

    func entry(
        key: GraphQLCacheKey,
        body: Data = Data("{}".utf8),
        status: Int = 200,
        contentType: String? = "application/json",
        createdAt: Date = Date(timeIntervalSinceReferenceDate: 10),
        writeAt: Date = Date(timeIntervalSinceReferenceDate: 20),
        accessAt: Date = Date(timeIntervalSinceReferenceDate: 30),
        facets: GraphQLCacheEntryFacets? = nil
    ) -> GraphQLCacheEntry {
        GraphQLCacheEntry(
            key: key,
            body: body,
            status: status,
            contentType: contentType,
            createdAt: createdAt,
            lastSuccessfulWriteAt: writeAt,
            lastAccessedAt: accessAt,
            facets: facets ?? self.facets(seed: "default")
        )
    }

    func facets(seed: String) -> GraphQLCacheEntryFacets {
        GraphQLCacheEntryFacets(
            endpoint: digest("\(seed)-endpoint"),
            authorizationScope: digest("\(seed)-scope"),
            userIdentity: digest("\(seed)-user"),
            operationName: digest("\(seed)-operation"),
            namespace: digest("\(seed)-namespace"),
            tags: [digest("\(seed)-tag")]
        )
    }

    func digestKey(_ seed: String) -> GraphQLCacheKey {
        GraphQLCacheKey(rawValue: NhostSHA256.hexadecimalDigest(Data(seed.utf8)))
    }

    func digest(_ seed: String) -> GraphQLCacheDigest {
        GraphQLCacheDigest(rawValue: NhostSHA256.hexadecimalDigest(Data(seed.utf8)))
    }

    func date(_ value: Int) -> Date {
        Date(timeIntervalSinceReferenceDate: TimeInterval(value))
    }

    func temporaryDirectory() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("nhost-graphql-cache-\(UUID().uuidString)", isDirectory: true)
    }

    func entryURL(_ directory: URL, _ key: GraphQLCacheKey) -> URL {
        directory.appendingPathComponent(key.rawValue).appendingPathExtension("entry")
    }
}
