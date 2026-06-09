import Foundation

public struct NhostRequest: Sendable, Equatable {
    public var method: String
    public var url: URL
    public var headers: [String: String]
    public var body: Data?

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
