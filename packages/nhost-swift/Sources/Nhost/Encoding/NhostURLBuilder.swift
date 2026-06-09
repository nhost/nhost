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
        let childPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        components.percentEncodedPath = [basePath, childPath]
            .filter { !$0.isEmpty }
            .joined(separator: "/")

        if !components.percentEncodedPath.hasPrefix("/") {
            components.percentEncodedPath = "/\(components.percentEncodedPath)"
        }

        return components.url ?? baseURL.appendingPathComponent(path)
    }

    public static func percentEncodePathSegment(_ segment: String) -> String {
        var allowed = CharacterSet.urlPathAllowed
        allowed.remove(charactersIn: "/?#[]@!$&'()*+,;=")
        return segment.addingPercentEncoding(withAllowedCharacters: allowed) ?? segment
    }
}
