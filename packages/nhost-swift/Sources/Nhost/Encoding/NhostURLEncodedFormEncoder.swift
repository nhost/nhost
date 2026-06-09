import Foundation

public enum NhostURLEncodedFormEncoder {
    public static let contentType = "application/x-www-form-urlencoded"

    public static func encode(_ fields: [String: JSONValue?]) -> Data {
        let body = NhostQueryEncoder.queryItems(from: fields)
            .map { item in
                let name = percentEncode(item.name)
                let value = percentEncode(item.value ?? "")
                return "\(name)=\(value)"
            }
            .joined(separator: "&")

        return Data(body.utf8)
    }

    public static func percentEncode(_ value: String) -> String {
        var allowed = CharacterSet.urlQueryAllowed
        allowed.remove(charactersIn: ":#[]@!$&'()*+,;=/?")

        return value
            .addingPercentEncoding(withAllowedCharacters: allowed)?
            .replacingOccurrences(of: "%20", with: "+") ?? ""
    }
}
