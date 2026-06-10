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
    public let url: URL
    private let fetch: FetchFunction

    public var baseURL: URL {
        url
    }

    public init(url: URL, fetch: @escaping FetchFunction) {
        self.url = url
        self.fetch = fetch
    }

    public init(baseURL: URL, fetch: @escaping FetchFunction) {
        self.init(url: baseURL, fetch: fetch)
    }

    public init(
        url: URL,
        transport: any HTTPTransport = URLSessionTransport(),
        middleware: [ChainFunction] = []
    ) {
        self.init(
            url: url,
            fetch: NhostFetchPipeline(transport: transport, middleware: middleware).fetch
        )
    }

    public init(
        baseURL: URL,
        transport: any HTTPTransport = URLSessionTransport(),
        middleware: [ChainFunction] = []
    ) {
        self.init(url: baseURL, transport: transport, middleware: middleware)
    }

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
            request: GraphQLRequest(query: query, variables: variables, operationName: operationName),
            headers: headers,
            decoder: decoder
        )
    }

    public func request<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type,
        request graphQLRequest: GraphQLRequest,
        headers: [String: String] = [:],
        decoder: @Sendable () -> JSONDecoder = { NhostJSON.neutralDecoder }
    ) async throws -> NhostResponse<GraphQLResponse<ResponseData>> {
        var requestHeaders = headers
        NhostHeaderLookup.setHeaderIfAbsent("accept", "application/json", on: &requestHeaders)
        NhostHeaderLookup.setHeaderIfAbsent("content-type", "application/json", on: &requestHeaders)

        let requestBody: Data
        do {
            requestBody = try NhostJSON.neutralEncoder.encode(graphQLRequest)
        } catch {
            throw FetchError.encoding(String(describing: error))
        }

        let response = try await fetch(
            NhostRequest(method: "POST", url: url, headers: requestHeaders, body: requestBody)
        )

        do {
            if let errorEnvelope = Self.decodeErrorEnvelope(from: response.body),
               let errors = errorEnvelope.errors,
               !errors.isEmpty
            {
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
