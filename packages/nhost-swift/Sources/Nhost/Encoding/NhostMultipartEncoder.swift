import Foundation

public struct NhostMultipartPart: Sendable, Equatable {
    public let name: String
    public let filename: String?
    public let contentType: String?
    public let body: Data

    public init(name: String, filename: String? = nil, contentType: String? = nil, body: Data) {
        self.name = name
        self.filename = filename
        self.contentType = contentType
        self.body = body
    }

    public static func formField(name: String, value: JSONValue) -> NhostMultipartPart {
        NhostMultipartPart(name: name, body: Data(NhostHeaderEncoder.headerValue(from: value).utf8))
    }

    public static func file(
        name: String,
        filename: String,
        contentType: String? = nil,
        data: Data
    ) -> NhostMultipartPart {
        NhostMultipartPart(name: name, filename: filename, contentType: contentType, body: data)
    }
}

public struct NhostMultipartBody: Sendable, Equatable {
    public let body: Data
    public let contentType: String

    public init(body: Data, contentType: String) {
        self.body = body
        self.contentType = contentType
    }
}

public enum NhostMultipartEncoder {
    public static func encode(
        parts: [NhostMultipartPart],
        boundary: String = UUID().uuidString
    ) -> NhostMultipartBody {
        var body = Data()

        parts.forEach { part in
            body.appendString("--\(boundary)\r\n")
            body.appendString("Content-Disposition: form-data; name=\"\(escape(part.name))\"")

            if let filename = part.filename {
                body.appendString("; filename=\"\(escape(filename))\"")
            }

            body.appendString("\r\n")

            if let contentType = part.contentType {
                body.appendString("Content-Type: \(sanitize(contentType))\r\n")
            }

            body.appendString("\r\n")
            body.append(part.body)
            body.appendString("\r\n")
        }

        body.appendString("--\(boundary)--\r\n")

        return NhostMultipartBody(
            body: body,
            contentType: "multipart/form-data; boundary=\(boundary)"
        )
    }

    private static func escape(_ value: String) -> String {
        sanitize(value)
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
    }

    // Part names, filenames, and content types are interpolated into part headers; a
    // CR/LF (or other control character) in them would let callers inject arbitrary
    // headers or terminate the part early, so control characters are dropped.
    private static func sanitize(_ value: String) -> String {
        String(value.unicodeScalars.filter { $0.value >= 0x20 && $0.value != 0x7F })
    }
}

private extension Data {
    mutating func appendString(_ value: String) {
        append(Data(value.utf8))
    }
}
