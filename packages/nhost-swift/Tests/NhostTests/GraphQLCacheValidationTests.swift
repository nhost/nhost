import Foundation
import XCTest
@testable import Nhost

final class GraphQLCacheValidationTests: GraphQLCacheStoreTestCase {
    func testMemoryStoreSanitizesContentTypeAndPreservesCreationOnOverwrite() async throws {
        let store = MemoryGraphQLCacheStore()
        let key = digestKey("memory-content")
        let created = date(10)
        try await store.write(
            entry(
                key: key,
                body: Data("first".utf8),
                contentType: "Application/JSON; charset=utf-8",
                createdAt: created,
                writeAt: date(11),
                accessAt: date(12)
            ),
            for: key
        )
        let initialRead = try await store.entry(for: key)
        var value = try XCTUnwrap(initialRead)
        XCTAssertEqual(value.contentType, "Application/JSON; charset=utf-8")

        try await store.write(
            entry(
                key: key,
                body: Data("second".utf8),
                contentType: "text/plain\r\nX-Secret: value",
                createdAt: date(20),
                writeAt: date(21),
                accessAt: date(22)
            ),
            for: key
        )
        let overwrittenRead = try await store.entry(for: key)
        value = try XCTUnwrap(overwrittenRead)
        XCTAssertEqual(value.body, Data("second".utf8))
        XCTAssertNil(value.contentType)
        XCTAssertEqual(value.createdAt, created)
        XCTAssertEqual(value.lastSuccessfulWriteAt, date(21))
    }

    func testEntryValidationRejectsMalformedCustomValues() throws {
        let key = digestKey("validation")
        let valid = entry(key: key)
        XCTAssertNoThrow(
            try GraphQLCacheEntryValidation.validatedCustomRead(
                valid,
                requestedKey: key,
                expectedFacets: valid.facets,
                maximumEntryBytes: 100
            )
        )
        XCTAssertThrowsError(
            try GraphQLCacheEntryValidation.validatedCustomRead(
                valid,
                requestedKey: key,
                expectedFacets: facets(seed: "different"),
                maximumEntryBytes: 100
            )
        )

        let malformed = [
            entry(key: digestKey("other")),
            entry(key: key, status: 401),
            entry(key: key, contentType: "text/plain"),
            entry(key: key, contentType: "application/json\u{7f}")
        ]
        for value in malformed {
            XCTAssertThrowsError(
                try GraphQLCacheEntryValidation.validatedCustomRead(
                    value,
                    requestedKey: key,
                    maximumEntryBytes: 100
                )
            )
        }
    }
}
