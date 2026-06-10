import Foundation

public typealias FetchFunction = @Sendable (NhostRequest) async throws -> NhostRawResponse
public typealias ChainFunction = @Sendable (NhostRequest, @escaping FetchFunction) async throws -> NhostRawResponse

public struct NhostFetchPipeline: Sendable {
    public let fetch: FetchFunction

    public init(transport: any HTTPTransport = URLSessionTransport(), middleware: [ChainFunction] = []) {
        fetch = Self.compose(transport: transport, middleware: middleware)
    }

    public init(fetch: @escaping FetchFunction) {
        self.fetch = fetch
    }

    public func send(_ request: NhostRequest) async throws -> NhostRawResponse {
        try await fetch(request)
    }

    public static func compose(transport: any HTTPTransport, middleware: [ChainFunction]) -> FetchFunction {
        let terminal: FetchFunction = { request in
            try await transport.fetch(request)
        }

        return middleware.reversed().reduce(terminal) { next, middleware in
            { request in
                try await middleware(request, next)
            }
        }
    }
}

public enum NhostHTTP {
    public static func decodeResponse<Body: Decodable & Sendable>(
        _ bodyType: Body.Type,
        from response: NhostRawResponse,
        decoder: JSONDecoder = NhostJSON.restDecoder
    ) throws -> NhostResponse<Body> {
        guard response.isSuccess else {
            throw FetchError.http(
                NhostHTTPError.decode(status: response.status, headers: response.headers, body: response.body)
            )
        }

        do {
            return NhostResponse(
                body: try decoder.decode(bodyType, from: response.body),
                status: response.status,
                headers: response.headers
            )
        } catch {
            // String(describing:) keeps DecodingError coding paths and debug
            // descriptions; localizedDescription reduces them to a useless generic
            // sentence.
            throw FetchError.decoding(String(describing: error))
        }
    }

    public static func binaryResponse(from response: NhostRawResponse) throws -> NhostResponse<Data> {
        guard response.isSuccess else {
            throw FetchError.http(
                NhostHTTPError.decode(status: response.status, headers: response.headers, body: response.body)
            )
        }

        return NhostResponse(body: response.body, status: response.status, headers: response.headers)
    }

    public static func emptyResponse(from response: NhostRawResponse) throws -> NhostResponse<Void> {
        guard response.isSuccess else {
            throw FetchError.http(
                NhostHTTPError.decode(status: response.status, headers: response.headers, body: response.body)
            )
        }

        return NhostResponse(body: (), status: response.status, headers: response.headers)
    }
}
