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

    public var isSuccess: Bool {
        (200..<300).contains(status)
    }
}
