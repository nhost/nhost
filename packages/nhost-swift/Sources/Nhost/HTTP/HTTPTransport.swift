import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public protocol HTTPTransport: Sendable {
    func fetch(_ request: NhostRequest) async throws -> NhostRawResponse
}

private final class URLSessionBox: @unchecked Sendable {
    let session: URLSession

    init(session: URLSession) {
        self.session = session
    }
}

public struct URLSessionTransport: HTTPTransport {
    private let box: URLSessionBox

    public init(session: URLSession = .shared) {
        box = URLSessionBox(session: session)
    }

    public func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        var urlRequest = URLRequest(url: request.url)
        urlRequest.httpMethod = request.method
        urlRequest.httpBody = request.body

        request.headers.forEach { name, value in
            urlRequest.setValue(value, forHTTPHeaderField: name)
        }

        do {
            let (body, response) = try await box.session.data(for: urlRequest)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw FetchError.invalidResponse("Expected HTTPURLResponse")
            }

            return NhostRawResponse(
                status: httpResponse.statusCode,
                headers: Self.headers(from: httpResponse),
                body: body
            )
        } catch let error as FetchError {
            throw error
        } catch {
            throw FetchError.transport(error.localizedDescription)
        }
    }

    private static func headers(from response: HTTPURLResponse) -> [String: String] {
        var headers: [String: String] = [:]

        response.allHeaderFields.forEach { key, value in
            headers[String(describing: key)] = String(describing: value)
        }

        return headers
    }
}

public struct StubTransport: HTTPTransport {
    private let handler: @Sendable (NhostRequest) async throws -> NhostRawResponse

    public init(handler: @escaping @Sendable (NhostRequest) async throws -> NhostRawResponse) {
        self.handler = handler
    }

    public func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        try await handler(request)
    }
}
