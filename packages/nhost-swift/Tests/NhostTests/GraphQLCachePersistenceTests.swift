import Foundation
import XCTest
@testable import Nhost

final class GraphQLCachePersistenceTests: GraphQLCacheStoreTestCase {
    func testFileStoreRoundTripsAcrossRegistryRecreation() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let configuration = fileConfiguration(directory: directory)
        XCTAssertFalse(FileManager.default.fileExists(atPath: directory.path))
        let key = digestKey("round-trip")
        let body = Data([0, 1, 2, 3, 255])
        var store: FileGraphQLCacheStore? = FileGraphQLCacheStore(configuration: configuration)
        XCTAssertFalse(FileManager.default.fileExists(atPath: directory.path))
        try await store?.write(
            entry(
                key: key,
                body: body,
                contentType: "application/graphql-response+json; charset=UTF-8"
            ),
            for: key
        )
        let unknownTypeKey = digestKey("unknown-content-type")
        try await store?.write(
            entry(key: unknownTypeKey, contentType: "text/plain"),
            for: unknownTypeKey
        )
        store = nil

        let reopened = FileGraphQLCacheStore(configuration: configuration)
        let reopenedRead = try await reopened.entry(for: key)
        let value = try XCTUnwrap(reopenedRead)
        XCTAssertEqual(value.body, body)
        XCTAssertEqual(value.status, 200)
        XCTAssertEqual(value.contentType, "application/graphql-response+json; charset=UTF-8")
        XCTAssertEqual(value.facets, facets(seed: "default"))
        let unknownType = try await reopened.entry(for: unknownTypeKey)
        XCTAssertNil(try XCTUnwrap(unknownType).contentType)

        let envelope = try Data(contentsOf: entryURL(directory, key))
        XCTAssertTrue(envelope.suffix(body.count) == body)
        XCTAssertNil(envelope.range(of: Data("Authorization".utf8)))
    }

    func testRecoveryRemovesTemporaryAndMalformedEnvelopes() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let configuration = fileConfiguration(directory: directory)
        let goodKey = digestKey("good")
        let badKey = digestKey("bad")
        do {
            let store = FileGraphQLCacheStore(configuration: configuration)
            try await store.write(entry(key: goodKey), for: goodKey)
            try await store.write(entry(key: badKey), for: badKey)
        }

        var corrupt = try Data(contentsOf: entryURL(directory, badKey))
        corrupt[0] ^= 0xff
        try corrupt.write(to: entryURL(directory, badKey))
        let temp = directory.appendingPathComponent(".interrupted.tmp")
        try Data("partial".utf8).write(to: temp)

        let recovered = FileGraphQLCacheStore(configuration: configuration)
        let good = try await recovered.entry(for: goodKey)
        let bad = try await recovered.entry(for: badKey)
        XCTAssertNotNil(good)
        XCTAssertNil(bad)
        XCTAssertFalse(FileManager.default.fileExists(atPath: entryURL(directory, badKey).path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: temp.path))
    }

    func testRecoveryAtMaximumAcceptedEntryLimitDoesNotOverflow() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        let key = digestKey("maximum-entry-limit")
        let malformedEntryURL = entryURL(directory, key)
        try Data("malformed".utf8).write(to: malformedEntryURL)
        let maximumAcceptedEntryBytes = Int.max
            - GraphQLCacheEntryValidation.maximumEnvelopeOverheadBytes
        let store = FileGraphQLCacheStore(
            configuration: fileConfiguration(
                directory: directory,
                maximumTotalBytes: Int.max,
                maximumEntryBytes: maximumAcceptedEntryBytes
            )
        )

        try await store.prune()

        XCTAssertFalse(FileManager.default.fileExists(atPath: malformedEntryURL.path))
    }

    func testRecoveryRejectsTruncationVersionLengthAndFilenameKeyMismatch() async throws {
        enum Mutation {
            case truncate
            case version
            case length
            case keyMismatch
        }
        for (index, mutation) in [Mutation.truncate, .version, .length, .keyMismatch].enumerated() {
            let directory = temporaryDirectory()
            defer { try? FileManager.default.removeItem(at: directory) }
            let configuration = fileConfiguration(directory: directory)
            let key = digestKey("corrupt-\(index)")
            do {
                let store = FileGraphQLCacheStore(configuration: configuration)
                try await store.write(entry(key: key), for: key)
            }
            let url = entryURL(directory, key)
            let renamedKey = digestKey("filename-other")
            let renamedURL = entryURL(directory, renamedKey)
            switch mutation {
            case .truncate:
                let data = try Data(contentsOf: url)
                try data.prefix(12).write(to: url)
            case .version:
                var data = try Data(contentsOf: url)
                data[9] = 2
                try data.write(to: url)
            case .length:
                var data = try Data(contentsOf: url)
                data[10] = 0x7f
                try data.write(to: url)
            case .keyMismatch:
                try FileManager.default.moveItem(at: url, to: renamedURL)
            }
            let reopened = FileGraphQLCacheStore(configuration: configuration)
            let value = try await reopened.entry(for: key)
            XCTAssertNil(value, "mutation \(mutation) should be rejected")
            if case .keyMismatch = mutation {
                let renamedValue = try await reopened.entry(for: renamedKey)
                XCTAssertNil(
                    renamedValue,
                    "renamed envelope should not be accepted under its filename key"
                )
                XCTAssertFalse(FileManager.default.fileExists(atPath: renamedURL.path))
            }
        }
    }

    func testPersistedLRUUsesAccessThenKeyTieBreaker() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let configuration = fileConfiguration(
            directory: directory,
            maximumTotalBytes: 20,
            maximumEntryBytes: 10,
            maximumEntries: 2
        )
        let first = GraphQLCacheKey(rawValue: String(repeating: "a", count: 64))
        let second = GraphQLCacheKey(rawValue: String(repeating: "b", count: 64))
        let third = GraphQLCacheKey(rawValue: String(repeating: "c", count: 64))
        let sameAccess = date(50)
        do {
            let store = FileGraphQLCacheStore(configuration: configuration)
            try await store.write(entry(key: second, body: Data("22".utf8), accessAt: sameAccess), for: second)
            try await store.write(entry(key: first, body: Data("11".utf8), accessAt: sameAccess), for: first)
            try await store.write(entry(key: third, body: Data("33".utf8), accessAt: sameAccess), for: third)
            let firstAfterPrune = try await store.entry(for: first)
            let secondAfterPrune = try await store.entry(for: second)
            let thirdAfterPrune = try await store.entry(for: third)
            XCTAssertNil(firstAfterPrune)
            XCTAssertNotNil(secondAfterPrune)
            XCTAssertNotNil(thirdAfterPrune)
            try await store.touchEntry(for: second, at: date(100))
        }
        let reopened = FileGraphQLCacheStore(configuration: configuration)
        try await reopened.write(entry(key: first, body: Data("new".utf8), accessAt: date(75)), for: first)
        let persistedSecond = try await reopened.entry(for: second)
        let persistedThird = try await reopened.entry(for: third)
        let newFirst = try await reopened.entry(for: first)
        XCTAssertNotNil(persistedSecond)
        XCTAssertNil(persistedThird)
        XCTAssertNotNil(newFirst)
    }

    func testLimitsOversizeAndOverwriteAccounting() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let configuration = fileConfiguration(
            directory: directory,
            maximumTotalBytes: 8,
            maximumEntryBytes: 6,
            maximumEntries: 2
        )
        let store = FileGraphQLCacheStore(configuration: configuration)
        let oversizedKey = digestKey("oversized")
        do {
            try await store.write(
                entry(key: oversizedKey, body: Data(repeating: 1, count: 7)),
                for: oversizedKey
            )
            XCTFail("expected oversized entry")
        } catch let GraphQLCacheError.oversizedEntry(actual, maximum) {
            XCTAssertEqual(actual, 7)
            XCTAssertEqual(maximum, 6)
        }

        let first = digestKey("account-first")
        let second = digestKey("account-second")
        try await store.write(entry(key: first, body: Data(repeating: 1, count: 6)), for: first)
        try await store.write(entry(key: first, body: Data(repeating: 2, count: 2)), for: first)
        try await store.write(entry(key: second, body: Data(repeating: 3, count: 6)), for: second)
        let firstValue = try await store.entry(for: first)
        let secondValue = try await store.entry(for: second)
        XCTAssertNotNil(firstValue)
        XCTAssertNotNil(secondValue)
    }
}

extension GraphQLCachePersistenceTests {
    func testPreCancelledWriteDoesNotCommit() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FileGraphQLCacheStore(
            configuration: fileConfiguration(directory: directory)
        )
        try await store.prune()
        let key = digestKey("pre-cancelled")
        let value = entry(key: key)
        let task = Task {
            withUnsafeCurrentTask { $0?.cancel() }
            try await store.write(value, for: key)
        }
        switch await task.result {
        case .success:
            XCTFail("expected cancellation")
        case let .failure(error):
            XCTAssertTrue(error is CancellationError)
        }
        let stored = try await store.entry(for: key)
        XCTAssertNil(stored)
    }

    func testCancelledWriteAfterTemporaryFileSynchronizationRemovesArtifact() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let key = digestKey("cancelled-after-sync")
        let destination = entryURL(directory, key)
        let store = FileGraphQLCacheStore(
            configuration: fileConfiguration(directory: directory),
            didSynchronizeTemporaryFile: { temporary in
                XCTAssertNotEqual(temporary, destination)
                XCTAssertTrue(FileManager.default.fileExists(atPath: temporary.path))
                withUnsafeCurrentTask { $0?.cancel() }
            }
        )
        try await store.prune()
        let value = entry(key: key)

        let task = Task {
            try await store.write(value, for: key)
        }
        switch await task.result {
        case .success:
            XCTFail("expected cancellation")
        case let .failure(error):
            XCTAssertTrue(error is CancellationError)
        }

        let stored = try await store.entry(for: key)
        XCTAssertNil(stored)
        XCTAssertFalse(FileManager.default.fileExists(atPath: destination.path))
        let files = try FileManager.default.contentsOfDirectory(atPath: directory.path)
        XCTAssertFalse(files.contains { $0.hasSuffix(".tmp") })
    }
}
