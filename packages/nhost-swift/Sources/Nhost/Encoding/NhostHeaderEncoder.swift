import Foundation

public enum NhostHeaderEncoder {
    public static func merge(
        base: [String: String] = [:],
        values: [String: JSONValue?]
    ) -> [String: String] {
        var headers = base

        values.forEach { name, value in
            guard let value, value != .null else {
                headers.removeValue(forKey: name)
                return
            }

            headers[name] = headerValue(from: value)
        }

        return headers
    }

    public static func headerValue(from value: JSONValue) -> String {
        switch value {
        case let .array(values):
            values.map(headerValue(from:)).joined(separator: ",")
        case let .object(object):
            (try? String(data: NhostJSON.restEncoder.encode(JSONValue.object(object)), encoding: .utf8)) ?? ""
        case .null, .bool, .number, .string:
            NhostQueryEncoder.string(from: value)
        }
    }
}
