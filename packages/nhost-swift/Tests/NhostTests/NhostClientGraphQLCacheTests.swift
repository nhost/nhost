import Foundation
import XCTest
@testable import Nhost

actor FactoryGraphQLTransport: HTTPTransport {
    private var graphQLCalls = 0

    func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        if request.url.path.hasSuffix("/signout") || request.url.path.hasSuffix("/user/password") {
            return NhostRawResponse(
                status: 200,
                headers: ["content-type": "application/json"],
                body: Data(#""OK""#.utf8)
            )
        }
        if let body = request.body,
           (try? NhostJSON.neutralDecoder.decode(GraphQLRequest.self, from: body)) != nil {
            graphQLCalls += 1
            return NhostRawResponse(
                status: 200,
                headers: ["content-type": "application/json"],
                body: Data(#"{"data":{"ok":true}}"#.utf8)
            )
        }
        return NhostRawResponse(
            status: 200,
            headers: ["content-type": "application/json"],
            body: Data(#"{}"#.utf8)
        )
    }

    func callCount() -> Int {
        graphQLCalls
    }
}

actor FactoryCacheStore: GraphQLCacheStore {
    enum Failure: Error {
        case invalidation
    }

    private let backing = MemoryGraphQLCacheStore()
    private var invalidationFilters: [GraphQLCacheStoreFilter] = []
    private var writtenFacets: [GraphQLCacheEntryFacets] = []
    private var failInvalidation = false
    private var nextInvalidationGate: CacheReadGate?

    func entry(for key: GraphQLCacheKey) async throws -> GraphQLCacheEntry? {
        try await backing.entry(for: key)
    }

    func write(_ entry: GraphQLCacheEntry, for key: GraphQLCacheKey) async throws {
        try await backing.write(entry, for: key)
        writtenFacets.append(entry.facets)
    }

    func removeEntry(for key: GraphQLCacheKey) async throws {
        await backing.removeEntry(for: key)
    }

    func touchEntry(for key: GraphQLCacheKey, at date: Date) async throws {
        try await backing.touchEntry(for: key, at: date)
    }

    func invalidate(_ filter: GraphQLCacheStoreFilter) async throws -> Int {
        invalidationFilters.append(filter)
        if let gate = nextInvalidationGate {
            nextInvalidationGate = nil
            await gate.pause()
        }
        if failInvalidation { throw Failure.invalidation }
        return await backing.invalidate(filter)
    }

    func prune() async throws {
        await backing.prune()
    }

    func setInvalidationFailure(_ value: Bool) {
        failInvalidation = value
    }

    func gateNextInvalidation(_ gate: CacheReadGate) {
        nextInvalidationGate = gate
    }

    func invalidationCount() -> Int {
        invalidationFilters.count
    }

    func recordedInvalidationFilters() -> [GraphQLCacheStoreFilter] {
        invalidationFilters
    }

    func lastWrittenFacets() -> GraphQLCacheEntryFacets? {
        writtenFacets.last
    }
}

actor FactoryAsyncSignal {
    private var signaled = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func signal() {
        signaled = true
        let current = waiters
        waiters.removeAll()
        for waiter in current { waiter.resume() }
    }

    func wait() async {
        if signaled { return }
        await withCheckedContinuation { waiters.append($0) }
    }
}

final class NhostClientGraphQLCacheTests: XCTestCase {
    let graphQLURL = URL(string: "https://graphql.example.test/v1")!
    let authURL = URL(string: "https://auth.example.test/v1")!
    let query = "query Viewer { ok }"
}

extension NhostClientGraphQLCacheTests {
    func testNetworkOnlyFactoryCallDoesNotInitializeDefaultFileStore() async throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("nhost-factory-cache-\(UUID().uuidString)")
        let cacheDirectory = root.appendingPathComponent("responses")
        defer { try? FileManager.default.removeItem(at: root) }
        let diagnostics = CacheDiagnosticRecorder()
        let transport = FactoryGraphQLTransport()
        let client = createNhostClient(
            NhostClientOptions(
                graphqlURL: graphQLURL,
                transport: transport,
                graphqlCache: GraphQLCacheConfiguration(
                    directoryURL: cacheDirectory,
                    diagnosticObserver: diagnostics.record
                )
            )
        )

        let response = try await client.graphql.request(CacheBoolData.self, query: query)
        XCTAssertEqual(response.body.data?.ok, true)
        XCTAssertFalse(FileManager.default.fileExists(atPath: cacheDirectory.path))
        XCTAssertTrue(diagnostics.kinds().isEmpty)

        let disabled = createNhostClient(
            NhostClientOptions(graphqlURL: graphQLURL, transport: FactoryGraphQLTransport())
        )
        do {
            _ = try await disabled.graphql.cache.invalidate()
            XCTFail("an unconfigured factory cache must remain disabled")
        } catch {
            XCTAssertEqual(error as? GraphQLCacheError, .notConfigured)
        }
    }

    func testAllNhostFactoriesThreadGraphQLCacheAndKnownScopeState() async throws {
        let clientTransport = FactoryGraphQLTransport()
        let serverTransport = FactoryGraphQLTransport()
        let adminTransport = FactoryGraphQLTransport()
        let clients = [
            managedFactoryClient(
                session: try session(subject: "client-user"),
                store: FactoryCacheStore(),
                transport: clientTransport
            ),
            serverFactoryClient(
                session: try session(subject: "server-user"),
                store: FactoryCacheStore(),
                transport: serverTransport
            ),
            adminFactoryClient(store: FactoryCacheStore(), transport: adminTransport)
        ]

        for (index, client) in clients.enumerated() {
            _ = try await client.graphql.request(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(
                    policy: .cacheFirst,
                    namespace: "factory-\(index)"
                )
            )
            let cached = try await client.graphql.request(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(
                    policy: .cacheOnly,
                    namespace: "factory-\(index)"
                )
            )
            XCTAssertEqual(cached.body.data?.ok, true)
        }

        let callCounts = await (
            clientTransport.callCount(),
            serverTransport.callCount(),
            adminTransport.callCount()
        )
        XCTAssertEqual(callCounts.0, 1)
        XCTAssertEqual(callCounts.1, 1)
        XCTAssertEqual(callCounts.2, 1)
    }

    func testFactoryCustomMiddlewareWithoutResolverBypassesCache() async throws {
        let transport = FactoryGraphQLTransport()
        let client = customMiddlewareClient(
            store: FactoryCacheStore(),
            transport: transport,
            resolver: nil
        )
        _ = try await client.graphql.request(
            CacheBoolData.self,
            query: query,
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
        do {
            _ = try await client.graphql.request(
                CacheBoolData.self,
                query: query,
                cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
            )
            XCTFail("custom middleware without a resolver must bypass caching")
        } catch {
            XCTAssertEqual(error as? GraphQLCacheError, .unavailableScope)
        }
    }

    func testFactoryCustomResolverComposesWithKnownAndExplicitScope() async throws {
        let transport = FactoryGraphQLTransport()
        let client = customMiddlewareClient(
            store: FactoryCacheStore(),
            transport: transport,
            resolver: { context in
                XCTAssertEqual(context.sdkScope.effectiveRole, "user")
                return GraphQLCacheCustomScope(
                    identifier: "tenant-a",
                    protectedHeaders: ["x-custom-tenant": "tenant-a"]
                )
            }
        )
        _ = try await client.graphql.request(
            CacheBoolData.self,
            query: query,
            headers: ["Authorization": "Bearer explicit"],
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheFirst)
        )
        let cached = try await client.graphql.request(
            CacheBoolData.self,
            query: query,
            headers: ["Authorization": "Bearer explicit"],
            cacheOptions: GraphQLCacheRequestOptions(policy: .cacheOnly)
        )
        XCTAssertEqual(cached.body.data?.ok, true)
        let calls = await transport.callCount()
        XCTAssertEqual(calls, 1)
    }
}

extension NhostClientGraphQLCacheTests {
    func managedFactoryClient(
        session: StoredSession,
        store: FactoryCacheStore,
        transport: FactoryGraphQLTransport
    ) -> NhostClient {
        createClient(
            NhostClientOptions(
                graphqlURL: graphQLURL,
                sessionStorage: MemorySessionStorageBackend(session: session),
                transport: transport,
                defaultHeaders: ["x-client": "swift"],
                role: "user",
                sessionRefreshMarginSeconds: 60,
                graphqlCache: GraphQLCacheConfiguration(store: store)
            )
        )
    }

    func serverFactoryClient(
        session: StoredSession,
        store: FactoryCacheStore,
        transport: FactoryGraphQLTransport
    ) -> NhostClient {
        createServerClient(
            NhostServerClientOptions(
                graphqlURL: graphQLURL,
                sessionStorage: MemorySessionStorageBackend(session: session),
                transport: transport,
                role: "editor",
                graphqlCache: GraphQLCacheConfiguration(store: store)
            )
        )
    }

    func adminFactoryClient(
        store: FactoryCacheStore,
        transport: FactoryGraphQLTransport
    ) -> NhostClient {
        createNhostClient(
            NhostClientOptions(
                graphqlURL: graphQLURL,
                transport: transport,
                adminSession: AdminSessionOptions(adminSecret: "secret", role: "admin"),
                graphqlCache: GraphQLCacheConfiguration(store: store)
            )
        )
    }

    func customMiddlewareClient(
        store: FactoryCacheStore,
        transport: FactoryGraphQLTransport,
        resolver: GraphQLCacheScopeResolver?
    ) -> NhostClient {
        let middleware: ChainFunction = { request, next in
            var request = request
            request.setHeader("x-custom-tenant", "tenant-a")
            return try await next(request)
        }
        return createNhostClient(
            NhostClientOptions(
                graphqlURL: graphQLURL,
                transport: transport,
                middleware: [middleware],
                defaultHeaders: ["x-sdk": "swift"],
                role: "user",
                graphqlCache: GraphQLCacheConfiguration(
                    store: store,
                    scopeResolver: resolver
                )
            )
        )
    }
}
