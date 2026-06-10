import Foundation

public enum NhostBinaryBody {
    public static let contentType = "application/octet-stream"

    public static func encode(_ data: Data) -> Data {
        data
    }
}

public enum NhostURLBuilder {
    public static func url(baseURL: URL, path: String, query: [String: JSONValue?] = [:]) -> URL {
        let joined = join(baseURL: baseURL, path: path)
        return NhostQueryEncoder.append(query, to: joined)
    }

    public static func redirectURL(baseURL: URL, path: String, query: [String: JSONValue?] = [:]) -> URL {
        url(baseURL: baseURL, path: path, query: query)
    }

    public static func join(baseURL: URL, path: String) -> URL {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            return baseURL.appendingPathComponent(path)
        }

        let basePath = components.percentEncodedPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let childPath = validPercentEncodedPath(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))

        var joinedPath = [basePath, childPath]
            .filter { !$0.isEmpty }
            .joined(separator: "/")

        if !joinedPath.hasPrefix("/") {
            joinedPath = "/\(joinedPath)"
        }

        components.percentEncodedPath = joinedPath

        return components.url ?? baseURL.appendingPathComponent(path)
    }

    public static func percentEncodePathSegment(_ segment: String) -> String {
        var allowed = CharacterSet.urlPathAllowed
        allowed.remove(charactersIn: "/?#[]@!$&'()*+,;=")
        return segment.addingPercentEncoding(withAllowedCharacters: allowed) ?? segment
    }

    // The URLComponents percentEncoded* setters trap on strings that are not validly
    // percent-encoded for that component, so caller-provided paths and query strings
    // are passed through only when already valid and re-encoded otherwise.
    static func validPercentEncodedPath(_ value: String) -> String {
        if isValidlyPercentEncoded(value, allowed: .urlPathAllowed) {
            return value
        }

        return value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
    }

    static func validPercentEncodedQuery(_ value: String) -> String {
        if isValidlyPercentEncoded(value, allowed: .urlQueryAllowed) {
            return value
        }

        return value.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? value
    }

    private static func isValidlyPercentEncoded(_ value: String, allowed: CharacterSet) -> Bool {
        let scalars = Array(value.unicodeScalars)
        var index = 0

        while index < scalars.count {
            let scalar = scalars[index]

            if scalar == "%" {
                guard index + 2 < scalars.count,
                      isHexDigit(scalars[index + 1]),
                      isHexDigit(scalars[index + 2])
                else { return false }

                index += 3
                continue
            }

            guard allowed.contains(scalar) else { return false }
            index += 1
        }

        return true
    }

    private static func isHexDigit(_ scalar: Unicode.Scalar) -> Bool {
        (0x30...0x39).contains(scalar.value)
            || (0x41...0x46).contains(scalar.value)
            || (0x61...0x66).contains(scalar.value)
    }
}
