import Foundation

public struct NhostRequest: Sendable, Equatable {
    public var method: String
    public var url: URL
    public var headers: [String: String]
    public var body: Data?
    /// When set, the transport streams the request body from this file instead of
    /// `body` (which must be nil); the file must outlive the request. Used for
    /// large multipart uploads assembled by `NhostMultipartEncoder.encodeToFile`.
    public var bodyFileURL: URL?

    public init(
        method: String,
        url: URL,
        headers: [String: String] = [:],
        body: Data? = nil
    ) {
        self.method = method.uppercased()
        self.url = url
        self.headers = headers
        self.body = body
        bodyFileURL = nil
    }

    public init(
        method: String,
        url: URL,
        headers: [String: String] = [:],
        bodyFileURL: URL
    ) {
        self.method = method.uppercased()
        self.url = url
        self.headers = headers
        body = nil
        self.bodyFileURL = bodyFileURL
    }

    public mutating func setHeader(_ name: String, _ value: String?) {
        guard let value else {
            headers.removeValue(forKey: name)
            return
        }

        headers[name] = value
    }

    public func addingHeader(_ name: String, _ value: String?) -> NhostRequest {
        var copy = self
        copy.setHeader(name, value)
        return copy
    }
}
