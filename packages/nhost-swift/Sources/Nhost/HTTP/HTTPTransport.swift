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

    /// Uses a session with HTTP caching disabled: API responses must not be served
    /// stale after mutations (read-your-writes), and a disk-backed `URLCache` would
    /// persist authorized responses in cleartext. This also matches nhost-js, whose
    /// fetch (undici/Node) does not cache. Pass a custom session via
    /// `init(session:)` to opt back into caching.
    public init() {
        let configuration = URLSessionConfiguration.default
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData

        box = URLSessionBox(session: URLSession(configuration: configuration))
    }

    public init(session: URLSession) {
        box = URLSessionBox(session: session)
    }

    public func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        try Task.checkCancellation()

        var urlRequest = URLRequest(url: request.url)
        urlRequest.httpMethod = request.method

        request.headers.forEach { name, value in
            urlRequest.setValue(value, forHTTPHeaderField: name)
        }

        do {
            let body: Data
            let response: URLResponse

            if let bodyFileURL = request.bodyFileURL {
                (body, response) = try await upload(urlRequest, fromFile: bodyFileURL)
            } else {
                urlRequest.httpBody = request.body
                (body, response) = try await box.session.data(for: urlRequest)
            }

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
        } catch is CancellationError {
            // Cancellation must stay distinguishable from network failures so retry
            // layers do not retry deliberately cancelled requests.
            throw CancellationError()
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch let error as URLError {
            throw FetchError.transport("URLError \(error.code.rawValue): \(error.localizedDescription)")
        } catch {
            throw FetchError.transport(String(describing: error))
        }
    }

    private func upload(_ urlRequest: URLRequest, fromFile fileURL: URL) async throws -> (Data, URLResponse) {
        #if canImport(FoundationNetworking)
        // swift-corelibs-foundation does not ship the async upload(for:fromFile:)
        // convenience; wrap the callback-based task instead.
        try await withCheckedThrowingContinuation { continuation in
            let task = box.session.uploadTask(with: urlRequest, fromFile: fileURL) { data, response, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let response {
                    continuation.resume(returning: (data ?? Data(), response))
                } else {
                    continuation.resume(throwing: URLError(.badServerResponse))
                }
            }
            task.resume()
        }
        #else
        try await box.session.upload(for: urlRequest, fromFile: fileURL)
        #endif
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
