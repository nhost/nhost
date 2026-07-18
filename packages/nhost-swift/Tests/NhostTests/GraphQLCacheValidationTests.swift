import Foundation
import XCTest
@testable import Nhost

final class GraphQLCacheValidationTests: GraphQLCacheStoreTestCase {
    func testMemoryStoreValidatedConstructionRejectsInvalidLimits() {
        let invalidLimits = [
            (maximumTotalBytes: 0, maximumEntryBytes: 1, maximumEntries: 1),
            (maximumTotalBytes: 1, maximumEntryBytes: 0, maximumEntries: 1),
            (maximumTotalBytes: 1, maximumEntryBytes: 2, maximumEntries: 1),
            (maximumTotalBytes: 1, maximumEntryBytes: 1, maximumEntries: 0),
            (
                maximumTotalBytes: Int.max,
                maximumEntryBytes: Int.max
                    - GraphQLCacheEntryValidation.maximumEnvelopeOverheadBytes + 1,
                maximumEntries: 1
            )
        ]

        for limits in invalidLimits {
            XCTAssertThrowsError(
                try MemoryGraphQLCacheStore.validated(
                    maximumTotalBytes: limits.maximumTotalBytes,
                    maximumEntryBytes: limits.maximumEntryBytes,
                    maximumEntries: limits.maximumEntries
                )
            ) { error in
                guard case .invalidConfiguration = error as? GraphQLCacheError else {
                    return XCTFail("expected invalidConfiguration, got \(error)")
                }
            }
        }
    }

    func testMemoryStoreValidatedConstructionAcceptsExactBoundaries() async throws {
        let minimumStore = try MemoryGraphQLCacheStore.validated(
            maximumTotalBytes: 1,
            maximumEntryBytes: 1,
            maximumEntries: 1
        )
        let key = digestKey("memory-minimum-limits")
        try await minimumStore.write(entry(key: key, body: Data([0x7b])), for: key)
        let storedEntry = try await minimumStore.entry(for: key)
        XCTAssertEqual(storedEntry?.body, Data([0x7b]))

        let maximumAcceptedEntryBytes = Int.max
            - GraphQLCacheEntryValidation.maximumEnvelopeOverheadBytes
        XCTAssertNoThrow(
            try MemoryGraphQLCacheStore.validated(
                maximumTotalBytes: Int.max,
                maximumEntryBytes: maximumAcceptedEntryBytes,
                maximumEntries: Int.max
            )
        )
    }

    func testMemoryStoreSourceCompatibleInitializerRejectsInvalidLimitsOnWrite() async {
        let stores = [
            MemoryGraphQLCacheStore(maximumTotalBytes: 1_024),
            MemoryGraphQLCacheStore(
                maximumTotalBytes: 1,
                maximumEntryBytes: 1,
                maximumEntries: -1
            )
        ]
        let key = digestKey("memory-invalid-deferred-limits")
        let value = entry(key: key, body: Data([0x7b]))

        for store in stores {
            do {
                try await store.write(value, for: key)
                XCTFail("expected invalidConfiguration")
            } catch {
                guard case .invalidConfiguration = error as? GraphQLCacheError else {
                    return XCTFail("expected invalidConfiguration, got \(error)")
                }
            }
        }
    }

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
