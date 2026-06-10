import Foundation

public enum NhostQueryEncoder {
    public static func append(_ parameters: [String: JSONValue?], to url: URL) -> URL {
        guard !parameters.isEmpty else { return url }

        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return url
        }

        // Merge via the percent-encoded view so existing items are never decoded and
        // re-encoded. New items are encoded here rather than by URLComponents' own
        // queryItems setter, which leaves "+" raw — form-style parsers (and nhost-js,
        // whose URLSearchParams emits %2B) decode a raw "+" as a space.
        let encodedItems = queryItems(from: parameters).map { item in
            URLQueryItem(
                name: percentEncodeQueryComponent(item.name),
                value: item.value.map(percentEncodeQueryComponent)
            )
        }
        components.percentEncodedQueryItems = (components.percentEncodedQueryItems ?? [])
            + encodedItems

        return components.url ?? url
    }

    private static func percentEncodeQueryComponent(_ value: String) -> String {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: ":#[]@!$&'()*+,;=/?")

        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
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
