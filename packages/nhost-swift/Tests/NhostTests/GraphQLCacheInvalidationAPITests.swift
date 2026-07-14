import Foundation
import XCTest
@testable import Nhost

final class GraphQLCacheInvalidationAPITests: GraphQLCacheStoreTestCase {
    private let endpoint = URL(string: "https://graphql.example.test/v1")!

    func testCurrentScopeInvalidationComposesWithOtherPublicFilters() async throws {
        let currentScope = digest("current-scope-composed")
        let currentViewer = try identity(operationName: "Viewer", scope: currentScope)
        let currentSettings = try identity(operationName: "Settings", scope: currentScope)
        let otherViewer = try identity(
            operationName: "Viewer",
            scope: digest("other-scope-composed")
        )
        let store = MemoryGraphQLCacheStore()
        try await write([currentViewer, currentSettings, otherViewer], to: store)
        let handle = GraphQLCacheHandle(store: store, currentAuthorizationScope: { currentScope })

        let removed = try await handle.invalidate(
            GraphQLCacheInvalidationFilter(scope: .current, operationName: "Viewer")
        )

        XCTAssertEqual(removed, 1)
        let removedValue = try await store.entry(for: currentViewer.key)
        let sameScopeDifferentOperation = try await store.entry(for: currentSettings.key)
        let sameOperationDifferentScope = try await store.entry(for: otherViewer.key)
        XCTAssertNil(removedValue)
        XCTAssertNotNil(sameScopeDifferentOperation)
        XCTAssertNotNil(sameOperationDifferentScope)
    }

    func testUserInvalidationRemovesAllRoleAndClaimsScopesOnlyForThatUser() async throws {
        let userScopes = try ["role-user", "role-editor", "changed-claims"].map {
            try identity(operationName: "Viewer", scope: digest($0), user: "user-1")
        }
        let otherUser = try identity(
            operationName: "Viewer",
            scope: digest("other-user-scope"),
            user: "user-2"
        )
        let store = MemoryGraphQLCacheStore()
        try await write(userScopes + [otherUser], to: store)
        let handle = GraphQLCacheHandle(store: store, currentAuthorizationScope: { nil })

        let removed = try await handle.invalidate(
            GraphQLCacheInvalidationFilter(scope: .user("user-1"))
        )

        XCTAssertEqual(removed, userScopes.count)
        for identity in userScopes {
            let removedValue = try await store.entry(for: identity.key)
            XCTAssertNil(removedValue)
        }
        let retainedValue = try await store.entry(for: otherUser.key)
        XCTAssertNotNil(retainedValue)
    }

    func testCurrentScopeInvalidationFailsWhenScopeCannotBeDerived() async throws {
        let handle = GraphQLCacheHandle(
            store: MemoryGraphQLCacheStore(),
            currentAuthorizationScope: { nil }
        )

        do {
            _ = try await handle.invalidate(GraphQLCacheInvalidationFilter(scope: .current))
            XCTFail("expected unavailable scope")
        } catch {
            XCTAssertEqual(error as? GraphQLCacheError, .unavailableScope)
        }
    }

    func testManagedUserFacetMatchesCallerAddressableNhostUserID() throws {
        let token = try testAccessToken(subject: "user-1")
        let session = try StoredSession(try testAuthSession(accessToken: token))

        XCTAssertEqual(session.stableUserIdentity, "user-1")
        XCTAssertEqual(
            GraphQLCacheKeyBuilder.facetDigest(
                domain: "user",
                value: try XCTUnwrap(session.stableUserIdentity)
            ),
            GraphQLCacheKeyBuilder.facetDigest(domain: "user", value: "user-1")
        )
    }

    private func identity(
        operationName: String,
        scope: GraphQLCacheDigest,
        user: String = "user-1"
    ) throws -> GraphQLCacheIdentity {
        try GraphQLCacheKeyBuilder.makeIdentity(
            endpoint: endpoint,
            operation: GraphQLSelectedOperation(kind: .query, name: operationName),
            query: "query \(operationName) { viewer { id } }",
            variables: nil,
            authorizationScope: scope,
            userIdentity: user,
            namespace: nil,
            tags: []
        )
    }

    private func write(
        _ identities: [GraphQLCacheIdentity],
        to store: MemoryGraphQLCacheStore
    ) async throws {
        for identity in identities {
            try await store.write(entry(key: identity.key, facets: identity.facets), for: identity.key)
        }
    }
}
