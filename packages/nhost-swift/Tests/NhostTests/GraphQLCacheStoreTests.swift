import Foundation
import XCTest
@testable import Nhost
final class GraphQLCacheManagementTests: GraphQLCacheStoreTestCase {
    func testInvalidationFiltersComposeAndIgnoreLastAccessForAge() async throws {
        let store = MemoryGraphQLCacheStore()
        let endpointA = digest("endpoint-a")
        let endpointB = digest("endpoint-b")
        let scopeA = digest("scope-a")
        let userA = digest("user-a")
        let operationA = digest("operation-a")
        let namespaceA = digest("namespace-a")
        let tagA = digest("tag-a")
        let key1 = digestKey("invalidate-1")
        let key2 = digestKey("invalidate-2")
        let key3 = digestKey("invalidate-3")

        try await store.write(
            entry(
                key: key1,
                createdAt: date(10),
                writeAt: date(20),
                accessAt: date(1_000),
                facets: GraphQLCacheEntryFacets(
                    endpoint: endpointA,
                    authorizationScope: scopeA,
                    userIdentity: userA,
                    operationName: operationA,
                    namespace: namespaceA,
                    tags: [tagA]
                )
            ),
            for: key1
        )
        try await store.write(
            entry(
                key: key2,
                createdAt: date(30),
                writeAt: date(40),
                facets: GraphQLCacheEntryFacets(
                    endpoint: endpointA,
                    authorizationScope: scopeA,
                    userIdentity: userA,
                    operationName: operationA,
                    namespace: namespaceA,
                    tags: [tagA]
                )
            ),
            for: key2
        )
        try await store.write(
            entry(
                key: key3,
                facets: GraphQLCacheEntryFacets(
                    endpoint: endpointB,
                    authorizationScope: digest("scope-b"),
                    userIdentity: nil,
                    operationName: nil,
                    namespace: nil,
                    tags: []
                )
            ),
            for: key3
        )

        let removed = await store.invalidate(
            GraphQLCacheStoreFilter(
                endpoint: endpointA,
                authorizationScope: scopeA,
                userIdentity: userA,
                operationName: operationA,
                namespace: namespaceA,
                tag: tagA,
                createdAtOrBefore: date(20),
                lastSuccessfulWriteAtOrBefore: date(25)
            )
        )
        XCTAssertEqual(removed, 1)
        let firstValue = try await store.entry(for: key1)
        let secondValue = try await store.entry(for: key2)
        let thirdValue = try await store.entry(for: key3)
        XCTAssertNil(firstValue)
        XCTAssertNotNil(secondValue)
        XCTAssertNotNil(thirdValue)
    }

    func testHandleMapsPublicFiltersAndDisabledHandleThrows() async throws {
        let disabled = GraphQLCacheHandle()
        await XCTAssertThrowsErrorAsync(try await disabled.invalidate()) { error in
            XCTAssertEqual(error as? GraphQLCacheError, .notConfigured)
        }

        let endpoint = try XCTUnwrap(URL(string: "HTTPS://Example.COM:443/v1/graphql"))
        let identity = try GraphQLCacheKeyBuilder.makeIdentity(
            endpoint: endpoint,
            operation: GraphQLSelectedOperation(kind: .query, name: "Viewer"),
            query: "query Viewer { viewer { id } }",
            variables: nil,
            authorizationScope: digest("current-scope"),
            userIdentity: "user-1",
            namespace: "screen",
            tags: ["profile"]
        )
        let store = MemoryGraphQLCacheStore()
        try await store.write(
            entry(key: identity.key, facets: identity.facets),
            for: identity.key
        )
        let currentScope = digest("current-scope")
        let handle = GraphQLCacheHandle(store: store, currentAuthorizationScope: {
            currentScope
        })
        let removed = try await handle.invalidate(
            GraphQLCacheInvalidationFilter(
                endpoint: endpoint,
                scope: .user("user-1"),
                operationName: "Viewer",
                namespace: "screen",
                tag: "profile"
            )
        )
        XCTAssertEqual(removed, 1)
        let remaining = try await store.entry(for: identity.key)
        XCTAssertNil(remaining)
    }

    func testConcurrentFileOperationsRemainConsistent() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let configuration = fileConfiguration(
            directory: directory,
            maximumTotalBytes: 10_000,
            maximumEntryBytes: 100,
            maximumEntries: 100
        )
        let store = FileGraphQLCacheStore(configuration: configuration)
        let values = (0 ..< 40).map { index in
            let key = digestKey("concurrent-\(index)")
            return (
                key,
                entry(key: key, body: Data("value-\(index)".utf8)),
                date(1_000 + index)
            )
        }
        try await withThrowingTaskGroup(of: Void.self) { group in
            for (key, value, accessDate) in values {
                group.addTask {
                    try await store.write(value, for: key)
                    _ = try await store.entry(for: key)
                    try await store.touchEntry(for: key, at: accessDate)
                }
            }
            try await group.waitForAll()
        }
        let removed = try await store.invalidate(GraphQLCacheStoreFilter())
        XCTAssertEqual(removed, 40)
    }

    func testConflictingDirectoryConfigurationsFailClosed() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let first = FileGraphQLCacheStore(
            configuration: fileConfiguration(
                directory: directory,
                maximumTotalBytes: 100,
                maximumEntryBytes: 50
            )
        )
        let second = FileGraphQLCacheStore(
            configuration: fileConfiguration(
                directory: directory.appendingPathComponent("../\(directory.lastPathComponent)"),
                maximumTotalBytes: 200,
                maximumEntryBytes: 50
            )
        )
        try await first.prune()
        await XCTAssertThrowsErrorAsync(try await second.prune()) { error in
            guard case .invalidConfiguration = error as? GraphQLCacheError else {
                return XCTFail("expected invalidConfiguration, got \(error)")
            }
        }
    }

    #if canImport(Darwin)
    func testDirectoryIsExcludedFromBackupAndProtectionIsApplied() async throws {
        let directory = temporaryDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }
        let store = FileGraphQLCacheStore(
            configuration: fileConfiguration(
                directory: directory,
                fileProtection: .completeUntilFirstUserAuthentication
            )
        )
        try await store.prune()
        let values = try directory.resourceValues(forKeys: [.isExcludedFromBackupKey])
        XCTAssertEqual(values.isExcludedFromBackup, true)
        let attributes = try FileManager.default.attributesOfItem(atPath: directory.path)
        XCTAssertEqual(
            attributes[.protectionKey] as? FileProtectionType,
            .completeUntilFirstUserAuthentication
        )
    }
    #endif

}
private func XCTAssertThrowsErrorAsync<T>(
    _ expression: @autoclosure () async throws -> T,
    _ errorHandler: (Error) -> Void,
    file: StaticString = #filePath,
    line: UInt = #line
) async {
    do {
        _ = try await expression()
        XCTFail("expected error", file: file, line: line)
    } catch {
        errorHandler(error)
    }
}
