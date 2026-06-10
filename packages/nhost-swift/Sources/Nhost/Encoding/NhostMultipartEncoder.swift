import Foundation

public struct NhostMultipartPart: Sendable, Equatable {
    public let name: String
    public let filename: String?
    public let contentType: String?
    public let content: NhostFileSource

    public init(name: String, filename: String? = nil, contentType: String? = nil, body: Data) {
        self.init(name: name, filename: filename, contentType: contentType, content: .data(body))
    }

    public init(
        name: String,
        filename: String? = nil,
        contentType: String? = nil,
        content: NhostFileSource
    ) {
        self.name = name
        self.filename = filename
        self.contentType = contentType
        self.content = content
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

    /// A file part streamed from disk. Only honored by `encodeToFile`; the
    /// in-memory `encode` reads the file fully.
    public static func file(
        name: String,
        filename: String,
        contentType: String? = nil,
        fileURL: URL
    ) -> NhostMultipartPart {
        NhostMultipartPart(
            name: name,
            filename: filename,
            contentType: contentType,
            content: .fileURL(fileURL)
        )
    }
}

/// A fully assembled multipart body stored on disk, ready to be streamed by the
/// transport. The caller owns `fileURL` and should delete it after the upload.
public struct NhostMultipartFileBody: Sendable {
    public let fileURL: URL
    public let contentType: String

    public init(fileURL: URL, contentType: String) {
        self.fileURL = fileURL
        self.contentType = contentType
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
    private static let fileCopyChunkSize = 1 << 20

    /// Assembles the multipart body in memory. `.fileURL` parts are read fully —
    /// callers that want to keep large files off the heap should use
    /// `encodeToFile` instead.
    public static func encode(
        parts: [NhostMultipartPart],
        boundary: String = UUID().uuidString
    ) -> NhostMultipartBody {
        var body = Data()

        parts.forEach { part in
            body.appendString(partHeader(for: part, boundary: boundary))

            switch part.content {
            case let .data(data):
                body.append(data)
            case let .fileURL(url):
                body.append((try? Data(contentsOf: url)) ?? Data())
            }

            body.appendString("\r\n")
        }

        body.appendString("--\(boundary)--\r\n")

        return NhostMultipartBody(
            body: body,
            contentType: "multipart/form-data; boundary=\(boundary)"
        )
    }

    /// Assembles the multipart body into a temporary file so the transport can
    /// stream it from disk: `.fileURL` parts are copied in chunks and never fully
    /// loaded into memory. The caller owns the returned file and should delete it
    /// after the upload completes.
    public static func encodeToFile(
        parts: [NhostMultipartPart],
        boundary: String = UUID().uuidString
    ) throws -> NhostMultipartFileBody {
        let destination = FileManager.default.temporaryDirectory
            .appendingPathComponent("nhost-multipart-\(UUID().uuidString)")

        FileManager.default.createFile(atPath: destination.path, contents: nil)
        let handle = try FileHandle(forWritingTo: destination)
        defer { try? handle.close() }

        do {
            for part in parts {
                try handle.write(contentsOf: Data(partHeader(for: part, boundary: boundary).utf8))

                switch part.content {
                case let .data(data):
                    try handle.write(contentsOf: data)
                case let .fileURL(url):
                    try copyFileContents(from: url, to: handle)
                }

                try handle.write(contentsOf: Data("\r\n".utf8))
            }

            try handle.write(contentsOf: Data("--\(boundary)--\r\n".utf8))
        } catch {
            try? FileManager.default.removeItem(at: destination)
            throw error
        }

        return NhostMultipartFileBody(
            fileURL: destination,
            contentType: "multipart/form-data; boundary=\(boundary)"
        )
    }

    private static func copyFileContents(from source: URL, to handle: FileHandle) throws {
        let reader = try FileHandle(forReadingFrom: source)
        defer { try? reader.close() }

        while let chunk = try reader.read(upToCount: fileCopyChunkSize), !chunk.isEmpty {
            try handle.write(contentsOf: chunk)
        }
    }

    private static func partHeader(for part: NhostMultipartPart, boundary: String) -> String {
        var header = "--\(boundary)\r\n"
        header += "Content-Disposition: form-data; name=\"\(escape(part.name))\""

        if let filename = part.filename {
            header += "; filename=\"\(escape(filename))\""
        }

        header += "\r\n"

        if let contentType = part.contentType {
            header += "Content-Type: \(sanitize(contentType))\r\n"
        }

        header += "\r\n"

        return header
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
