import Foundation
import XCTest
@testable import Nhost

final class GraphQLCachePrimitiveTests: XCTestCase {
    func testSHA256KnownVectors() {
        XCTAssertEqual(
            NhostSHA256.hexadecimalDigest(Data()),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        )
        XCTAssertEqual(
            NhostSHA256.hexadecimalDigest(Data("abc".utf8)),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        )
    }

    func testCanonicalVariablesSortObjectKeysRecursively() throws {
        let first: [String: JSONValue] = [
            "z": .array([.null, .bool(true), .number(42.5)]),
            "a": .object(["second": .string("two"), "first": .number(1)]),
        ]
        let second: [String: JSONValue] = [
            "a": .object(["first": .number(1), "second": .string("two")]),
            "z": .array([.null, .bool(true), .number(42.5)]),
        ]

        XCTAssertEqual(
            try GraphQLCanonicalVariables.serialize(first),
            try GraphQLCanonicalVariables.serialize(second)
        )
        XCTAssertEqual(
            try GraphQLCacheKeyBuilder.variablesDigest(first),
            try GraphQLCacheKeyBuilder.variablesDigest(second)
        )
    }

    func testCanonicalVariablesPreserveTypesAndAbsentPresence() throws {
        let absent = try GraphQLCanonicalVariables.serialize(nil)
        let empty = try GraphQLCanonicalVariables.serialize([:])

        XCTAssertNotEqual(absent, empty)
        XCTAssertNotEqual(
            try GraphQLCanonicalVariables.serialize(["value": .number(1)]),
            try GraphQLCanonicalVariables.serialize(["value": .string("1")])
        )
        XCTAssertNotEqual(
            try GraphQLCanonicalVariables.serialize(["value": .bool(false)]),
            try GraphQLCanonicalVariables.serialize(["value": .number(0)])
        )
        XCTAssertNotEqual(
            try GraphQLCanonicalVariables.serialize(["value": .array([])]),
            try GraphQLCanonicalVariables.serialize(["value": .object([:])])
        )
    }

    func testCanonicalVariablesRejectNonFiniteNumbers() {
        for value in [Double.nan, Double.infinity, -Double.infinity] {
            XCTAssertThrowsError(
                try GraphQLCanonicalVariables.serialize(["value": .number(value)])
            ) { error in
                XCTAssertEqual(
                    error as? GraphQLCacheKeyGenerationFailure,
                    .nonFiniteNumber
                )
            }
        }
    }

    func testExactQueryTextAndAugmentingDimensionsChangeKeys() throws {
        let endpoint = try XCTUnwrap(URL(string: "https://Example.COM:443/v1/graphql"))
        let operation = GraphQLSelectedOperation(kind: .query, name: "Viewer")
        let scope = GraphQLCacheDigest(rawValue: "protected-scope")
        let baseline = try GraphQLCacheKeyBuilder.makeIdentity(
            endpoint: endpoint,
            operation: operation,
            query: "query Viewer { viewer { id } }",
            variables: nil,
            authorizationScope: scope
        )
        let whitespaceChanged = try GraphQLCacheKeyBuilder.makeIdentity(
            endpoint: endpoint,
            operation: operation,
            query: "query Viewer {  viewer { id } }",
            variables: nil,
            authorizationScope: scope
        )
        let augmented = try GraphQLCacheKeyBuilder.makeIdentity(
            endpoint: endpoint,
            operation: operation,
            query: "query Viewer { viewer { id } }",
            variables: nil,
            authorizationScope: scope,
            namespace: "screen",
            tags: ["viewer", "profile"]
        )

        XCTAssertEqual(
            baseline.queryDigest.rawValue,
            "a2ece046ab18d8ab4a34fdf4541b1c2b927a0b5beadc371486f8f33fa5fb9c02"
        )
        XCTAssertEqual(
            baseline.variablesDigest.rawValue,
            "cb4c4fe2672966d9258d58fb9a04470c16ed4547cc5b92ed5688c9af5fc86de1"
        )
        XCTAssertEqual(
            baseline.key.rawValue,
            "09850f4d820a399027597440029d7987124bc7a088d292b8fb2b6476f80d4bff"
        )
        XCTAssertNotEqual(baseline.queryDigest, whitespaceChanged.queryDigest)
        XCTAssertNotEqual(baseline.key, whitespaceChanged.key)
        XCTAssertNotEqual(baseline.key, augmented.key)
        XCTAssertEqual(baseline.queryDigest, augmented.queryDigest)
        XCTAssertEqual(baseline.variablesDigest, augmented.variablesDigest)
        XCTAssertEqual(baseline.facets.endpoint, augmented.facets.endpoint)
        XCTAssertEqual(baseline.facets.authorizationScope, augmented.facets.authorizationScope)
    }

    func testTagOrderDoesNotChangeIdentity() throws {
        let endpoint = try XCTUnwrap(URL(string: "https://example.com/v1/graphql"))
        let operation = GraphQLSelectedOperation(kind: .query, name: "Viewer")
        let scope = GraphQLCacheDigest(rawValue: "protected-scope")
        let first = try GraphQLCacheKeyBuilder.makeIdentity(
            endpoint: endpoint,
            operation: operation,
            query: "query Viewer { viewer { id } }",
            variables: [:],
            authorizationScope: scope,
            tags: Set(["a", "b"])
        )
        let second = try GraphQLCacheKeyBuilder.makeIdentity(
            endpoint: endpoint,
            operation: operation,
            query: "query Viewer { viewer { id } }",
            variables: [:],
            authorizationScope: scope,
            tags: Set(["b", "a"])
        )

        XCTAssertEqual(first, second)
    }

    func testConfigurationDefaultsAndTimeBoundaries() throws {
        let defaults = GraphQLCacheConfiguration()
        XCTAssertEqual(defaults.freshnessTTL, 300)
        XCTAssertEqual(defaults.staleIfErrorInterval, 86_400)
        XCTAssertEqual(defaults.maximumTotalBytes, 50 * 1_024 * 1_024)
        XCTAssertEqual(defaults.maximumEntryBytes, 5 * 1_024 * 1_024)
        XCTAssertEqual(defaults.maximumEntries, 1_000)
        XCTAssertEqual(defaults.fileProtection, .completeUntilFirstUserAuthentication)
        XCTAssertTrue(defaults.purgePreviousScopeOnSignOut)
        XCTAssertNoThrow(try defaults.validate())

        let configuration = GraphQLCacheConfiguration(
            freshnessTTL: 10,
            staleIfErrorInterval: 20
        )
        XCTAssertEqual(
            configuration.age(
                now: Date(timeIntervalSince1970: 90),
                lastSuccessfulWriteAt: Date(timeIntervalSince1970: 100)
            ),
            0
        )
        XCTAssertTrue(configuration.isFresh(age: 10))
        XCTAssertFalse(configuration.isStaleEligible(age: 10))
        XCTAssertTrue(configuration.isStaleEligible(age: 10.000_001))
        XCTAssertTrue(configuration.isStaleEligible(age: 30))
        XCTAssertFalse(configuration.isStaleEligible(age: 30.000_001))
    }

    func testConfigurationValidationRejectsInvalidAndContradictoryLimits() {
        let invalidConfigurations = [
            GraphQLCacheConfiguration(freshnessTTL: -1),
            GraphQLCacheConfiguration(staleIfErrorInterval: -.infinity),
            GraphQLCacheConfiguration(
                freshnessTTL: Double.greatestFiniteMagnitude,
                staleIfErrorInterval: Double.greatestFiniteMagnitude
            ),
            GraphQLCacheConfiguration(maximumTotalBytes: 0),
            GraphQLCacheConfiguration(maximumEntryBytes: -1),
            GraphQLCacheConfiguration(maximumTotalBytes: 10, maximumEntryBytes: 11),
            GraphQLCacheConfiguration(maximumEntries: 0),
            GraphQLCacheConfiguration(directoryURL: URL(string: "https://example.com/cache"))
        ]

        for configuration in invalidConfigurations {
            XCTAssertThrowsError(try configuration.validate()) { error in
                guard case .invalidConfiguration = error as? GraphQLCacheError else {
                    return XCTFail("expected invalidConfiguration, got \(error)")
                }
            }
        }
    }

    func testPublicContractsAreSendable() {
        let resolver: GraphQLCacheScopeResolver = { _ in nil }
        let observer: GraphQLCacheDiagnosticObserver = { _ in }

        assertSendable(GraphQLCacheRequestOptions(policy: .cacheFirst, tags: ["tag"]))
        assertSendable(GraphQLCacheInvalidationFilter(scope: .current))
        assertSendable(resolver)
        assertSendable(observer)
        assertSendable(
            GraphQLCacheConfiguration(
                scopeResolver: resolver,
                diagnosticObserver: observer
            )
        )
    }

    private func assertSendable<Value: Sendable>(_: Value) {}
}
