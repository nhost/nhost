import Foundation

public struct GraphQLRequest: Codable, Sendable, Equatable {
    public let query: String
    public let variables: [String: JSONValue]?
    public let operationName: String?

    public init(
        query: String,
        variables: [String: JSONValue]? = nil,
        operationName: String? = nil
    ) {
        self.query = query
        self.variables = variables
        self.operationName = operationName
    }
}

public struct GraphQLResponse<ResponseData: Decodable & Sendable>: Decodable, Sendable {
    public let data: ResponseData?
    public let errors: [GraphQLError]?

    public init(data: ResponseData? = nil, errors: [GraphQLError]? = nil) {
        self.data = data
        self.errors = errors
    }
}

extension GraphQLResponse: Equatable where ResponseData: Equatable {}

public struct GraphQLErrorLocation: Decodable, Sendable, Equatable {
    public let line: Int
    public let column: Int

    public init(line: Int, column: Int) {
        self.line = line
        self.column = column
    }
}

public struct GraphQLError: Decodable, Sendable, Equatable {
    public let message: String
    public let locations: [GraphQLErrorLocation]?
    public let path: [JSONValue]?
    public let extensions: [String: JSONValue]?

    public init(
        message: String,
        locations: [GraphQLErrorLocation]? = nil,
        path: [JSONValue]? = nil,
        extensions: [String: JSONValue]? = nil
    ) {
        self.message = message
        self.locations = locations
        self.path = path
        self.extensions = extensions
    }
}

public struct GraphQLExecutionError: Error, Sendable, Equatable {
    public let errors: [GraphQLError]
    public let status: Int
    public let headers: [String: String]
    public let data: JSONValue?
    public let rawBody: Data

    public init(
        errors: [GraphQLError],
        status: Int,
        headers: [String: String],
        data: JSONValue? = nil,
        rawBody: Data
    ) {
        self.errors = errors
        self.status = status
        self.headers = headers
        self.data = data
        self.rawBody = rawBody
    }

    public var messages: [String] {
        errors.map(\.message)
    }
}

extension GraphQLExecutionError: NhostServiceError {
    public var statusCode: Int? { status }
    public var responseHeaders: [String: String] { headers }
}

extension GraphQLExecutionError: LocalizedError {
    public var errorDescription: String? {
        messages.joined(separator: ", ")
    }
}

public struct GraphQLClient: Sendable {
    struct EncodedRequest {
        let request: NhostRequest
        let body: Data
    }

    public let url: URL
    public let cache: GraphQLCacheHandle
    private let fetch: FetchFunction
    private let cacheCoordinator: GraphQLCacheCoordinator?

    public var baseURL: URL {
        url
    }

    public init(url: URL, fetch: @escaping FetchFunction) {
        self.url = url
        self.fetch = fetch
        cacheCoordinator = nil
        cache = GraphQLCacheHandle()
    }

    public init(baseURL: URL, fetch: @escaping FetchFunction) {
        self.init(url: baseURL, fetch: fetch)
    }

    public init(
        url: URL,
        transport: any HTTPTransport = URLSessionTransport(),
        middleware: [ChainFunction] = [],
        cacheConfiguration: GraphQLCacheConfiguration? = nil
    ) {
        self.init(
            url: url,
            transport: transport,
            middleware: middleware,
            cacheConfiguration: cacheConfiguration,
            cacheScopeContext: .standalone(hasCustomMiddleware: !middleware.isEmpty),
            cacheClock: Date.init
        )
    }

    public init(
        baseURL: URL,
        transport: any HTTPTransport = URLSessionTransport(),
        middleware: [ChainFunction] = [],
        cacheConfiguration: GraphQLCacheConfiguration? = nil
    ) {
        self.init(
            url: baseURL,
            transport: transport,
            middleware: middleware,
            cacheConfiguration: cacheConfiguration
        )
    }

    init(
        url: URL,
        transport: any HTTPTransport,
        middleware: [ChainFunction],
        cacheConfiguration: GraphQLCacheConfiguration?,
        cacheScopeContext: GraphQLCacheClientScopeContext,
        cacheClock: @escaping @Sendable () -> Date
    ) {
        let pipeline = NhostFetchPipeline(transport: transport, middleware: middleware)
        self.url = url
        fetch = pipeline.fetch

        guard let cacheConfiguration,
              let executor = pipeline.contextualExecutor else {
            cacheCoordinator = nil
            cache = GraphQLCacheHandle()
            return
        }

        let store = cacheConfiguration.store
            ?? FileGraphQLCacheStore(configuration: cacheConfiguration)
        let coordinator = GraphQLCacheCoordinator(
            configuration: cacheConfiguration,
            store: store,
            executor: executor,
            scopeContext: cacheScopeContext,
            clock: cacheClock,
            endpoint: url
        )
        cacheCoordinator = coordinator
        cache = GraphQLCacheHandle(
            store: store,
            currentAuthorizationScope: {
                try await coordinator.currentAuthorizationScopeDigest()
            },
            diagnosticObserver: cacheConfiguration.diagnosticObserver
        )
    }

    /// Source-compatible legacy overload. In particular, this preserves calls
    /// that supply the decoder as a trailing closure.
    public func request<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        query: String,
        variables: [String: JSONValue]? = nil,
        operationName: String? = nil,
        headers: [String: String] = [:],
        decoder: @Sendable () -> JSONDecoder = { NhostJSON.neutralDecoder }
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        try await request(
            responseType,
            query: query,
            variables: variables,
            operationName: operationName,
            headers: headers,
            decoder: decoder,
            cacheOptions: GraphQLCacheRequestOptions()
        )
    }

    public func request<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        query: String,
        variables: [String: JSONValue]? = nil,
        operationName: String? = nil,
        headers: [String: String] = [:],
        decoder: @Sendable () -> JSONDecoder = { NhostJSON.neutralDecoder },
        cacheOptions: GraphQLCacheRequestOptions = GraphQLCacheRequestOptions()
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        try await request(
            responseType,
            request: GraphQLRequest(query: query, variables: variables, operationName: operationName),
            headers: headers,
            decoder: decoder,
            cacheOptions: cacheOptions
        )
    }

    /// Source-compatible legacy overload, including decoder trailing closures.
    public func request<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        request graphQLRequest: GraphQLRequest,
        headers: [String: String] = [:],
        decoder: @Sendable () -> JSONDecoder = { NhostJSON.neutralDecoder }
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        try await request(
            responseType,
            request: graphQLRequest,
            headers: headers,
            decoder: decoder,
            cacheOptions: GraphQLCacheRequestOptions()
        )
    }

    public func request<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        request graphQLRequest: GraphQLRequest,
        headers: [String: String] = [:],
        decoder: @Sendable () -> JSONDecoder = { NhostJSON.neutralDecoder },
        cacheOptions: GraphQLCacheRequestOptions = GraphQLCacheRequestOptions()
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        if cacheOptions.policy == .networkOnly {
            return try await Self.legacyRequest(
                responseType,
                url: url,
                graphQLRequest: graphQLRequest,
                headers: headers,
                decoder: decoder,
                fetch: fetch
            )
        }

        guard let cacheCoordinator else {
            if cacheOptions.policy == .cacheOnly {
                throw GraphQLCacheError.notConfigured
            }
            return try await Self.legacyRequest(
                responseType,
                url: url,
                graphQLRequest: graphQLRequest,
                headers: headers,
                decoder: decoder,
                fetch: fetch
            )
        }

        return try await cacheCoordinator.request(
            responseType,
            graphQLRequest: graphQLRequest,
            headers: headers,
            decoder: decoder,
            cacheOptions: cacheOptions,
            legacyFetch: fetch
        )
    }

    static func legacyRequest<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        url: URL,
        graphQLRequest: GraphQLRequest,
        headers: [String: String],
        decoder: @Sendable () -> JSONDecoder,
        fetch: FetchFunction
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        let encoded = try encodedRequest(
            url: url,
            graphQLRequest: graphQLRequest,
            headers: headers
        )
        let response = try await fetch(encoded.request)
        return try decodeResponse(responseType, from: response, decoder: decoder)
    }

    static func encodedRequest(
        url: URL,
        graphQLRequest: GraphQLRequest,
        headers: [String: String]
    ) throws -> EncodedRequest {
        var requestHeaders = headers
        NhostHeaderLookup.setHeaderIfAbsent("accept", "application/json", on: &requestHeaders)
        NhostHeaderLookup.setHeaderIfAbsent("content-type", "application/json", on: &requestHeaders)

        let requestBody: Data
        do {
            requestBody = try NhostJSON.neutralEncoder.encode(graphQLRequest)
        } catch {
            throw FetchError.encoding(String(describing: error))
        }
        return EncodedRequest(
            request: NhostRequest(
                method: "POST",
                url: url,
                headers: requestHeaders,
                body: requestBody
            ),
            body: requestBody
        )
    }

    static func decodeResponse<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        from response: NhostRawResponse,
        decoder: @Sendable () -> JSONDecoder
    ) throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        do {
            if let errorEnvelope = decodeErrorEnvelope(from: response.body),
               let errors = errorEnvelope.errors,
               !errors.isEmpty {
                throw GraphQLExecutionError(
                    errors: errors,
                    status: response.status,
                    headers: response.headers,
                    data: errorEnvelope.data,
                    rawBody: response.body
                )
            }
            let body = try decoder().decode(GraphQLResponse<ResponseData>.self, from: response.body)
            return NhostResponse(body: body, status: response.status, headers: response.headers)
        } catch let error as GraphQLExecutionError {
            throw error
        } catch let error as FetchError {
            throw error
        } catch {
            throw FetchError.decoding(String(describing: error))
        }
    }

    private static func decodeErrorEnvelope(from body: Data) -> GraphQLErrorEnvelope? {
        try? NhostJSON.neutralDecoder.decode(GraphQLErrorEnvelope.self, from: body)
    }
}

private struct GraphQLErrorEnvelope: Decodable {
    let data: JSONValue?
    let errors: [GraphQLError]?
}
