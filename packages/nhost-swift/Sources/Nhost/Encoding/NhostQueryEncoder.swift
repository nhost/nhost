import Foundation

public enum NhostQueryEncoder {
    public static func append(_ parameters: [String: JSONValue?], to url: URL) -> URL {
        guard !parameters.isEmpty else { return url }

        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let existingItems = components?.queryItems ?? []
        let encodedItems = queryItems(from: parameters)
        components?.queryItems = existingItems + encodedItems

        return components?.url ?? url
    }

    public static func queryItems(from parameters: [String: JSONValue?]) -> [URLQueryItem] {
        var items: [URLQueryItem] = []

        parameters.keys.sorted().forEach { name in
            guard let optionalValue = parameters[name], let value = optionalValue else { return }
            appendItems(name: name, value: value, into: &items)
        }

        return items
    }

    public static func string(from value: JSONValue) -> String {
        switch value {
        case .null:
            return ""
        case let .bool(value):
            return value ? "true" : "false"
        case let .number(value):
            if value.isFinite,
               value.rounded(.towardZero) == value,
               value >= Double(Int.min),
               value <= Double(Int.max) {
                return String(Int(value))
            }

            return String(value)
        case let .string(value):
            return value
        case .array, .object:
            return (try? String(data: NhostJSON.restEncoder.encode(value), encoding: .utf8)) ?? ""
        }
    }

    private static func appendItems(name: String, value: JSONValue, into items: inout [URLQueryItem]) {
        switch value {
        case .null:
            return
        case let .array(values):
            values.forEach { appendItems(name: name, value: $0, into: &items) }
        case let .object(object):
            object.keys.sorted().forEach { key in
                guard let value = object[key] else { return }
                appendItems(name: "\(name)[\(key)]", value: value, into: &items)
            }
        case .bool, .number, .string:
            items.append(URLQueryItem(name: name, value: string(from: value)))
        }
    }
}
