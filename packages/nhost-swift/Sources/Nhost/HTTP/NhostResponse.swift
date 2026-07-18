import Foundation

public struct NhostResponse<Body: Sendable>: Sendable {
    public let body: Body
    public let status: Int
    public let headers: [String: String]

    public init(body: Body, status: Int, headers: [String: String]) {
        self.body = body
        self.status = status
        self.headers = headers
    }

    /// Returns a response header using HTTP's case-insensitive field-name semantics.
    ///
    /// The original `headers` dictionary remains available with transport-provided spelling.
    public func header(named name: String) -> String? {
        NhostHeaderLookup.value(in: headers, named: name)
    }
}

extension NhostResponse: Equatable where Body: Equatable {}

public struct NhostRawResponse: Sendable, Equatable {
    public let status: Int
    public let headers: [String: String]
    public let body: Data

    public init(status: Int, headers: [String: String] = [:], body: Data = Data()) {
        self.status = status
        self.headers = headers
        self.body = body
    }

    /// Returns a response header using HTTP's case-insensitive field-name semantics.
    ///
    /// Custom transports do not need to normalize field-name spelling for this accessor.
    public func header(named name: String) -> String? {
        NhostHeaderLookup.value(in: headers, named: name)
    }

    public var isSuccess: Bool {
        (200..<300).contains(status)
    }
}
