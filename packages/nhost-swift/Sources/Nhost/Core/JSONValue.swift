import Foundation

/// Untyped JSON representation used for generated map values, variables, and error bodies.
public enum JSONValue: Codable, Sendable, Hashable {
    case null
    case bool(Bool)
    /// An exact signed 64-bit JSON integer.
    case integer(Int64)
    /// A binary floating-point JSON number.
    ///
    /// Decoding selects ``integer(_:)`` for integral values. Integral JSON values outside the
    /// signed 64-bit range are rejected instead of being rounded through `Double`.
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if container.decodeNil() {
            self = .null
            return
        }

        if let value = try? container.decode(Bool.self) {
            self = .bool(value)
            return
        }

        if let value = try? container.decode(Int64.self) {
            self = .integer(value)
            return
        }

        if let value = try? container.decode(Double.self) {
            guard !value.isFinite || value.rounded(.towardZero) != value else {
                throw DecodingError.dataCorruptedError(
                    in: container,
                    debugDescription: "Integral JSON number is outside the signed 64-bit range"
                )
            }
            self = .number(value)
            return
        }

        if let value = try? container.decode(String.self) {
            self = .string(value)
            return
        }

        if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
            return
        }

        if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
            return
        }

        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "Unsupported JSON value"
        )
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch self {
        case .null:
            try container.encodeNil()
        case let .bool(value):
            try container.encode(value)
        case let .integer(value):
            try container.encode(value)
        case let .number(value):
            try container.encode(value)
        case let .string(value):
            try container.encode(value)
        case let .array(value):
            try container.encode(value)
        case let .object(value):
            try container.encode(value)
        }
    }

    public var stringValue: String? {
        guard case let .string(value) = self else { return nil }
        return value
    }

    public subscript(key: String) -> JSONValue? {
        guard case let .object(value) = self else { return nil }
        return value[key]
    }
}
