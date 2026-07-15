import Foundation

/// Helpers that turn generated Swift values into OpenAPI wire-format primitives.
public enum NhostWireEncoder {
    public static func jsonValue<T: Encodable>(_ value: T) throws -> JSONValue {
        let data = try NhostJSON.restEncoder.encode(value)
        return try NhostJSON.restDecoder.decode(JSONValue.self, from: data)
    }

    public static func string<T: Encodable>(_ value: T) throws -> String {
        NhostHeaderEncoder.headerValue(from: try jsonValue(value))
    }

    public static func jsonString<T: Encodable>(_ value: T) throws -> String {
        let data = try NhostJSON.restEncoder.encode(value)
        guard let string = String(data: data, encoding: .utf8) else {
            throw EncodingError.invalidValue(
                value,
                EncodingError.Context(
                    codingPath: [],
                    debugDescription: "JSON encoder produced non-UTF-8 data"
                )
            )
        }

        return string
    }

    public static func commaSeparated<T: Encodable>(_ values: [T]) throws -> String {
        try values.map { try string($0) }.joined(separator: ",")
    }
}
