import XCTest
@testable import Nhost

extension NhostClientGraphQLCacheTests {
    func testNoneFactoryAnonymousCacheDoesNotReadThrowingSessionBackend() async throws {
        try await assertUnmanagedFactoryCachesWithoutSessionRead()
    }

    func testNoneFactoryAdminCacheDoesNotReadThrowingSessionBackend() async throws {
        try await assertUnmanagedFactoryCachesWithoutSessionRead(
            adminSession: AdminSessionOptions(adminSecret: "secret", role: "admin")
        )
    }

    func testNoneFactoryExplicitAuthorizationCacheDoesNotReadThrowingSessionBackend() async throws {
        try await assertUnmanagedFactoryCachesWithoutSessionRead(
            requestHeaders: ["Authorization": "Bearer explicit"]
        )
    }

    func testManagedFactoryCacheStillRequiresReadableSessionSnapshot() async throws {
        let transport = FactoryGraphQLTransport()
        let client = createClient(
            NhostClientOptions(
                graphqlURL: graphQLURL,
                sessionManagement: .processLocal(
                    storage: FaultInjectingSessionBackend(getFailure: .storageRead)
                ),
                transport: transport,
                graphqlCache: GraphQLCacheConfiguration(store: FactoryCacheStore())
            )
        )

        do {
            _ = try await client.graphql.request(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
            )
            XCTFail("managed cache scope preparation must fail when the session is unreadable")
        } catch {
            XCTAssertEqual(error as? GraphQLCacheError, .unavailableScope)
        }
        let calls = await transport.callCount()
        XCTAssertEqual(calls, 0)
    }

    private func assertUnmanagedFactoryCachesWithoutSessionRead(
        adminSession: AdminSessionOptions? = nil,
        requestHeaders: [String: String] = [:]
    ) async throws {
        let transport = FactoryGraphQLTransport()
        let client = createNhostClient(
            NhostClientOptions(
                graphqlURL: graphQLURL,
                sessionManagement: .processLocal(
                    storage: FaultInjectingSessionBackend(getFailure: .storageRead)
                ),
                transport: transport,
                adminSession: adminSession,
                graphqlCache: GraphQLCacheConfiguration(store: FactoryCacheStore())
            )
        )

        let network = try await client.graphql.request(
            CacheBoolData.self,
            query: query,
            headers: requestHeaders,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
        XCTAssertEqual(network.body.data?.ok, true)
        let cached = try await client.graphql.request(
            CacheBoolData.self,
            query: query,
            headers: requestHeaders,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
        )
        XCTAssertEqual(cached.body.data?.ok, true)
        let calls = await transport.callCount()
        XCTAssertEqual(calls, 1)
    }
}
