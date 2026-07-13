import Foundation

public typealias FetchFunction = @Sendable (NhostRequest) async throws -> NhostRawResponse
public typealias ChainFunction = @Sendable (NhostRequest, @escaping FetchFunction) async throws -> NhostRawResponse

struct NhostTerminalRequestTranscript: Sendable {
    let requests: [NhostRequest]
}

struct NhostCapturedFetchResult: Sendable {
    let response: NhostRawResponse
    let transcript: NhostTerminalRequestTranscript
}

/// Rebuilds the middleware chain for each invocation around a call-local
/// capture actor. This avoids task-local/shared mutable capture and records every
/// terminal call, including concurrent or repeated `next` invocations.
struct NhostContextualFetchExecutor: Sendable {
    let transport: any HTTPTransport
    let middleware: [ChainFunction]

    func execute(_ request: NhostRequest) async throws -> NhostCapturedFetchResult {
        let capture = NhostTerminalRequestCapture()
        let terminal: FetchFunction = { request in
            await capture.record(request)
            return try await transport.fetch(request)
        }
        let contextualFetch = NhostFetchPipeline.compose(terminal: terminal, middleware: middleware)
        let response = try await contextualFetch(request)
        let requests = await capture.snapshot()
        return NhostCapturedFetchResult(
            response: response,
            transcript: NhostTerminalRequestTranscript(requests: requests)
        )
    }
}

private actor NhostTerminalRequestCapture {
    private var requests: [NhostRequest] = []

    func record(_ request: NhostRequest) {
        requests.append(request)
    }

    func snapshot() -> [NhostRequest] {
        requests
    }
}

public struct NhostFetchPipeline: Sendable {
    public let fetch: FetchFunction
    let contextualExecutor: NhostContextualFetchExecutor?

    public init(transport: any HTTPTransport = URLSessionTransport(), middleware: [ChainFunction] = []) {
        let executor = NhostContextualFetchExecutor(transport: transport, middleware: middleware)
        contextualExecutor = executor
        fetch = Self.compose(transport: transport, middleware: middleware)
    }

    public init(fetch: @escaping FetchFunction) {
        self.fetch = fetch
        contextualExecutor = nil
    }

    public func send(_ request: NhostRequest) async throws -> NhostRawResponse {
        try await fetch(request)
    }

    func sendCapturingTerminalRequests(_ request: NhostRequest) async throws -> NhostCapturedFetchResult? {
        guard let contextualExecutor else { return nil }
        return try await contextualExecutor.execute(request)
    }

    public static func compose(transport: any HTTPTransport, middleware: [ChainFunction]) -> FetchFunction {
        compose(
            terminal: { request in try await transport.fetch(request) },
            middleware: middleware
        )
    }

    static func compose(terminal: @escaping FetchFunction, middleware: [ChainFunction]) -> FetchFunction {
        middleware.reversed().reduce(terminal) { next, middleware in
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
