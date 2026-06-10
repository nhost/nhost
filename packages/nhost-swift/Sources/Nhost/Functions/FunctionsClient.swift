import Foundation

public enum FunctionsResponseBody<JSONBody: Sendable>: Sendable {
    case json(JSONBody)
    case text(String)
    case data(Data)

    public var json: JSONBody? {
        guard case let .json(value) = self else { return nil }
        return value
    }

    public var text: String? {
        guard case let .text(value) = self else { return nil }
        return value
    }

    public var data: Data? {
        guard case let .data(value) = self else { return nil }
        return value
    }
}

extension FunctionsResponseBody: Equatable where JSONBody: Equatable {}

public enum FunctionsErrorBody: Sendable, Equatable {
    case json(JSONValue)
    case text(String)
    case data(Data)
}

public struct FunctionsHTTPError: Error, Sendable, Equatable {
    public let status: Int
    public let headers: [String: String]
    public let body: FunctionsErrorBody
    public let rawBody: Data
    public let messages: [String]

    public init(
        status: Int,
        headers: [String: String],
        body: FunctionsErrorBody,
        rawBody: Data,
        messages: [String]
    ) {
        self.status = status
        self.headers = headers
        self.body = body
        self.rawBody = rawBody
        self.messages = messages
    }
}

extension FunctionsHTTPError: NhostServiceError {
    public var statusCode: Int? { status }
    public var responseHeaders: [String: String] { headers }
}

extension FunctionsHTTPError: LocalizedError {
    public var errorDescription: String? {
        messages.joined(separator: ", ")
    }
}

public struct FunctionsClient: Sendable {
    public let baseURL: URL
    private let fetch: FetchFunction

    public init(baseURL: URL, fetch: @escaping FetchFunction) {
        self.baseURL = baseURL
        self.fetch = fetch
    }

    public init(
        baseURL: URL,
        transport: any HTTPTransport = URLSessionTransport(),
        middleware: [ChainFunction] = []
    ) {
        self.init(
            baseURL: baseURL,
            fetch: NhostFetchPipeline(transport: transport, middleware: middleware).fetch
        )
    }

    public func fetch<ResponseBody: Decodable & Sendable>(
        _ responseType: ResponseBody.Type,
        path: String,
        method: String = "GET",
        headers: [String: String] = [:],
        body: Data? = nil,
        decoder: @Sendable () -> JSONDecoder = { NhostJSON.neutralDecoder }
    ) async throws -> NhostResponse<FunctionsResponseBody<ResponseBody>> {
        let request = NhostRequest(
            method: method,
            url: Self.url(baseURL: baseURL, path: path),
            headers: headers,
            body: body
        )
        let response = try await fetch(request)

        guard response.isSuccess else {
            throw Self.error(from: response)
        }

        return NhostResponse(
            body: try Self.decodeSuccessBody(responseType, from: response, decoder: decoder()),
            status: response.status,
            headers: response.headers
        )
    }

    public func post<RequestBody: Encodable & Sendable, ResponseBody: Decodable & Sendable>(
        _ responseType: ResponseBody.Type,
        path: String,
        body: RequestBody,
        headers: [String: String] = [:],
        encoder: @Sendable () -> JSONEncoder = { NhostJSON.neutralEncoder },
        decoder: @Sendable () -> JSONDecoder = { NhostJSON.neutralDecoder }
    ) async throws -> NhostResponse<FunctionsResponseBody<ResponseBody>> {
        var requestHeaders = headers
        NhostHeaderLookup.setHeaderIfAbsent("accept", "application/json", on: &requestHeaders)
        NhostHeaderLookup.setHeaderIfAbsent("content-type", "application/json", on: &requestHeaders)

        let requestBody: Data
        do {
            requestBody = try encoder().encode(body)
        } catch {
            throw FetchError.encoding(String(describing: error))
        }

        return try await fetch(
            responseType,
            path: path,
            method: "POST",
            headers: requestHeaders,
            body: requestBody,
            decoder: decoder
        )
    }

    public func post<ResponseBody: Decodable & Sendable>(
        _ responseType: ResponseBody.Type,
        path: String,
        headers: [String: String] = [:],
        decoder: @Sendable () -> JSONDecoder = { NhostJSON.neutralDecoder }
    ) async throws -> NhostResponse<FunctionsResponseBody<ResponseBody>> {
        var requestHeaders = headers
        NhostHeaderLookup.setHeaderIfAbsent("accept", "application/json", on: &requestHeaders)
        NhostHeaderLookup.setHeaderIfAbsent("content-type", "application/json", on: &requestHeaders)

        return try await fetch(
            responseType,
            path: path,
            method: "POST",
            headers: requestHeaders,
            body: nil,
            decoder: decoder
        )
    }

    private static func decodeSuccessBody<ResponseBody: Decodable & Sendable>(
        _ responseType: ResponseBody.Type,
        from response: NhostRawResponse,
        decoder: JSONDecoder
    ) throws -> FunctionsResponseBody<ResponseBody> {
        let contentType = contentType(from: response.headers)

        if isJSON(contentType) {
            do {
                return .json(try decoder.decode(responseType, from: response.body))
            } catch {
                throw FetchError.decoding(String(describing: error))
            }
        }

        if isText(contentType) {
            guard let text = String(data: response.body, encoding: .utf8) else {
                throw FetchError.decoding("Expected UTF-8 text response")
            }

            return .text(text)
        }

        return .data(response.body)
    }

    private static func error(from response: NhostRawResponse) -> FunctionsHTTPError {
        let body = decodeErrorBody(from: response)
        return FunctionsHTTPError(
            status: response.status,
            headers: response.headers,
            body: body,
            rawBody: response.body,
            messages: errorMessages(status: response.status, body: body)
        )
    }

    private static func decodeErrorBody(from response: NhostRawResponse) -> FunctionsErrorBody {
        let contentType = contentType(from: response.headers)

        if isJSON(contentType),
           let json = try? NhostJSON.neutralDecoder.decode(JSONValue.self, from: response.body)
        {
            return .json(json)
        }

        if isText(contentType),
           let text = String(data: response.body, encoding: .utf8)
        {
            return .text(text)
        }

        return .data(response.body)
    }

    private static func errorMessages(status: Int, body: FunctionsErrorBody) -> [String] {
        switch body {
        case let .json(value):
            NhostErrorMessageExtractor.messages(from: value, status: status)
        case let .text(value):
            value.isEmpty ? fallbackMessages(status: status) : [value]
        case .data:
            fallbackMessages(status: status)
        }
    }

    private static func fallbackMessages(status: Int) -> [String] {
        ["HTTP request failed with status \(status)"]
    }

    private static func contentType(from headers: [String: String]) -> String {
        NhostHeaderLookup.value(in: headers, named: "content-type")?.lowercased() ?? ""
    }

    private static func isJSON(_ contentType: String) -> Bool {
        let mediaType = contentType.split(separator: ";", maxSplits: 1).first?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let mediaType else { return false }
        return mediaType == "application/json" || mediaType.hasSuffix("+json")
    }

    private static func isText(_ contentType: String) -> Bool {
        contentType.trimmingCharacters(in: .whitespacesAndNewlines).hasPrefix("text/")
    }

    private static func url(baseURL: URL, path: String) -> URL {
        let parts = path.split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)
        let pathPart = parts.first.map(String.init) ?? ""
        let url = NhostURLBuilder.join(baseURL: baseURL, path: pathPart)

        guard parts.count == 2,
              var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else {
            return url
        }

        let queryPart = NhostURLBuilder.validPercentEncodedQuery(String(parts[1]))
        if let percentEncodedQuery = components.percentEncodedQuery, !percentEncodedQuery.isEmpty {
            components.percentEncodedQuery = [percentEncodedQuery, queryPart]
                .filter { !$0.isEmpty }
                .joined(separator: "&")
        } else {
            components.percentEncodedQuery = queryPart
        }

        return components.url ?? url
    }
}
