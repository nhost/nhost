import Foundation

public struct Smoke: Sendable {
    public let value: String

    public init(value: String) {
        self.value = value
    }

    public var epoch: Date {
        Date(timeIntervalSince1970: 0)
    }
}
