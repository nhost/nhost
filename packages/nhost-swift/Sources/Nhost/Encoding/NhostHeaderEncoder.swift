import Foundation

public enum NhostHeaderEncoder {
    public static func merge(
        base: [String: String] = [:],
        values: [String: JSONValue?]
    ) -> [String: String] {
        var headers = NhostHeaderLookup.normalized(base)

        for name in values.keys.sorted() {
            guard let value = values[name] ?? nil, value != .null else {
                NhostHeaderLookup.setHeader(name, nil, on: &headers)
                continue
            }

            NhostHeaderLookup.setHeader(name, headerValue(from: value), on: &headers)
        }

        return headers
    }

    /// Applies string header overrides with deterministic, case-insensitive replacement.
    public static func merge(
        base: [String: String] = [:],
        overrides: [String: String]
    ) -> [String: String] {
        NhostHeaderLookup.merging(base: base, overrides: overrides)
    }

    public static func headerValue(from value: JSONValue) -> String {
        switch value {
        case let .array(values):
            values.map(headerValue(from:)).joined(separator: ",")
        case let .object(object):
            (try? String(data: NhostJSON.restEncoder.encode(JSONValue.object(object)), encoding: .utf8)) ?? ""
        case .null, .bool, .integer, .number, .string:
            NhostQueryEncoder.string(from: value)
        }
    }
}
