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

struct URLSessionUploadTaskHandle: Sendable {
    let resume: @Sendable () -> Void
    let cancel: @Sendable () -> Void
}

private final class URLSessionUploadContinuation<Success: Sendable>: @unchecked Sendable {
    private enum InstallAction {
        case start
        case cancel
        case complete(Result<Success, any Error>)
    }

    private let lock = NSLock()
    private var continuation: CheckedContinuation<Success, any Error>?
    private var cancelTask: (@Sendable () -> Void)?
    private var pendingResult: Result<Success, any Error>?
    private var cancellationRequested = false
    private var isResolved = false

    func install(
        continuation: CheckedContinuation<Success, any Error>,
        task: URLSessionUploadTaskHandle
    ) {
        let action: InstallAction = lock.withLock {
            if cancellationRequested {
                isResolved = true
                return .cancel
            }
            if let pendingResult {
                isResolved = true
                self.pendingResult = nil
                return .complete(pendingResult)
            }

            self.continuation = continuation
            cancelTask = task.cancel
            return .start
        }

        switch action {
        case .start:
            task.resume()
        case .cancel:
            task.cancel()
            continuation.resume(throwing: CancellationError())
        case let .complete(result):
            continuation.resume(with: result)
        }
    }

    func complete(with result: Result<Success, any Error>) {
        let continuation: CheckedContinuation<Success, any Error>? = lock.withLock {
            guard !isResolved, !cancellationRequested else { return nil }
            guard let continuation = self.continuation else {
                pendingResult = result
                return nil
            }

            isResolved = true
            self.continuation = nil
            cancelTask = nil
            return continuation
        }

        continuation?.resume(with: result)
    }

    func cancel() {
        let action: (
            continuation: CheckedContinuation<Success, any Error>,
            cancelTask: (@Sendable () -> Void)?
        )? = lock.withLock {
            cancellationRequested = true
            guard !isResolved, let continuation else { return nil }

            isResolved = true
            self.continuation = nil
            let cancelTask = self.cancelTask
            self.cancelTask = nil
            return (continuation, cancelTask)
        }

        // Cancel before unblocking the caller so a deferred temporary-file cleanup
        // cannot race an upload task that has not yet observed cancellation.
        action?.cancelTask?()
        action?.continuation.resume(throwing: CancellationError())
    }
}

func withCancellableURLSessionUploadTask<Success: Sendable>(
    _ makeTask: @Sendable (
        @escaping @Sendable (Result<Success, any Error>) -> Void
    ) -> URLSessionUploadTaskHandle
) async throws -> Success {
    let state = URLSessionUploadContinuation<Success>()

    return try await withTaskCancellationHandler {
        try await withCheckedThrowingContinuation { continuation in
            let task = makeTask { result in
                state.complete(with: result)
            }
            state.install(continuation: continuation, task: task)
        }
    } onCancel: {
        state.cancel()
    }
}

public struct URLSessionTransport: HTTPTransport {
    private let box: URLSessionBox

    /// Uses a session without shared client state. API responses must not be served
    /// stale after mutations (read-your-writes), and neither authorized responses,
    /// cookies, nor credentials should persist or replay through Foundation's shared
    /// stores. Explicit Authorization and Cookie request headers are unaffected.
    /// This also matches nhost-js, whose fetch (undici/Node) does not persist this
    /// state. Pass a custom session via `init(session:)` to opt into Foundation's
    /// normal caching, cookie, or credential-storage behavior.
    public init() {
        let configuration = URLSessionConfiguration.default
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        configuration.httpCookieStorage = nil
        configuration.httpShouldSetCookies = false
        configuration.urlCredentialStorage = nil

        box = URLSessionBox(session: URLSession(configuration: configuration))
    }

    public init(session: URLSession) {
        box = URLSessionBox(session: session)
    }

    var sessionConfiguration: URLSessionConfiguration {
        box.session.configuration
    }

    public func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        try Task.checkCancellation()

        var urlRequest = Self.urlRequest(from: request)

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

    static func urlRequest(from request: NhostRequest) -> URLRequest {
        var urlRequest = URLRequest(url: request.url)
        urlRequest.httpMethod = request.method

        let headers = NhostHeaderLookup.normalized(request.headers)
        for name in headers.keys.sorted() {
            urlRequest.setValue(headers[name], forHTTPHeaderField: name)
        }

        return urlRequest
    }

    private func upload(_ urlRequest: URLRequest, fromFile fileURL: URL) async throws -> (Data, URLResponse) {
        #if canImport(FoundationNetworking)
        // swift-corelibs-foundation does not ship the async upload(for:fromFile:)
        // convenience; bridge its callback task while preserving Swift cancellation.
        try await withCancellableURLSessionUploadTask { completion in
            let task = box.session.uploadTask(with: urlRequest, fromFile: fileURL) { data, response, error in
                if let error {
                    completion(.failure(error))
                } else if let response {
                    completion(.success((data ?? Data(), response)))
                } else {
                    completion(.failure(URLError(.badServerResponse)))
                }
            }
            return URLSessionUploadTaskHandle(
                resume: { task.resume() },
                cancel: { task.cancel() }
            )
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
