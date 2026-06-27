import Foundation

/// A file to upload through ``StorageClient/uploadFiles(bucketId:files:extraHeaders:)``.
public struct NhostUploadFile: Sendable {
    public let source: NhostFileSource
    /// File name, sent as the multipart filename and in the metadata entry.
    public let name: String?
    /// Optional custom file id; the server generates a UUID when nil.
    public let id: String?
    /// Custom metadata to associate with the file.
    public let metadata: [String: JSONValue]?
    /// MIME type of the file part; defaults to application/octet-stream.
    public let contentType: String?

    public init(
        source: NhostFileSource,
        name: String? = nil,
        id: String? = nil,
        metadata: [String: JSONValue]? = nil,
        contentType: String? = nil
    ) {
        self.source = source
        self.name = name
        self.id = id
        self.metadata = metadata
        self.contentType = contentType
    }

    /// A file streamed from disk; `name` defaults to the URL's last path component.
    public static func fileURL(
        _ url: URL,
        name: String? = nil,
        id: String? = nil,
        metadata: [String: JSONValue]? = nil,
        contentType: String? = nil
    ) -> NhostUploadFile {
        NhostUploadFile(
            source: .fileURL(url),
            name: name ?? url.lastPathComponent,
            id: id,
            metadata: metadata,
            contentType: contentType
        )
    }

    /// An in-memory file.
    public static func data(
        _ data: Data,
        name: String? = nil,
        id: String? = nil,
        metadata: [String: JSONValue]? = nil,
        contentType: String? = nil
    ) -> NhostUploadFile {
        NhostUploadFile(source: .data(data), name: name, id: id, metadata: metadata, contentType: contentType)
    }
}

extension StorageClient {
    /// Streaming variant of `uploadFiles(body:)`.
    ///
    /// `.fileURL` sources are assembled into a temporary multipart file and streamed
    /// from disk by the transport, so large files are never fully loaded into memory
    /// (the temporary file is deleted after the upload). Uploads whose sources are
    /// all `.data` use the same in-memory path as the generated method.
    ///
    /// The multipart wire layout mirrors the generated `uploadFiles(body:)` exactly:
    /// `bucket-id`, then `file[]` parts, then `metadata[]` parts (metadata entries
    /// are positional — `metadata[i]` describes `file[i]` — so when any file carries
    /// a name/id/metadata, an entry is emitted for every file).
    public func uploadFiles(
        bucketId: String? = nil,
        files: [NhostUploadFile],
        extraHeaders: [String: String] = [:]
    ) async throws -> NhostResponse<StorageUploadFilesResponse201> {
        let url = NhostURLBuilder.url(baseURL: baseURL, path: "/files")
        var requestHeaders = [
            "accept": "application/json",
        ]

        var parts: [NhostMultipartPart] = []

        if let bucketId {
            parts.append(.formField(name: "bucket-id", value: try NhostWireEncoder.jsonValue(bucketId)))
        }

        for file in files {
            parts.append(
                NhostMultipartPart(
                    name: "file[]",
                    filename: file.name ?? "blob",
                    contentType: file.contentType ?? NhostBinaryBody.contentType,
                    content: file.source
                )
            )
        }

        if files.contains(where: { $0.id != nil || $0.name != nil || $0.metadata != nil }) {
            for file in files {
                let entry = StorageUploadFileMetadata(id: file.id, name: file.name, metadata: file.metadata)
                parts.append(
                    NhostMultipartPart(
                        name: "metadata[]",
                        contentType: "application/json",
                        body: try NhostJSON.restEncoder.encode(entry)
                    )
                )
            }
        }

        let streamsFromDisk = files.contains { file in
            if case .fileURL = file.source { return true }
            return false
        }

        var temporaryBody: URL?
        defer {
            if let temporaryBody {
                try? FileManager.default.removeItem(at: temporaryBody)
            }
        }

        let request: NhostRequest
        if streamsFromDisk {
            let multipartBody = try NhostMultipartEncoder.encodeToFile(parts: parts)
            temporaryBody = multipartBody.fileURL
            requestHeaders["content-type"] = multipartBody.contentType
            applyExtraHeaders(extraHeaders, to: &requestHeaders)
            request = NhostRequest(
                method: "POST",
                url: url,
                headers: requestHeaders,
                bodyFileURL: multipartBody.fileURL
            )
        } else {
            let multipartBody = try NhostMultipartEncoder.encode(parts: parts)
            requestHeaders["content-type"] = multipartBody.contentType
            applyExtraHeaders(extraHeaders, to: &requestHeaders)
            request = NhostRequest(
                method: "POST",
                url: url,
                headers: requestHeaders,
                body: multipartBody.body
            )
        }

        let response = try await fetch(request)

        return try NhostHTTP.decodeResponse(StorageUploadFilesResponse201.self, from: response)
    }

    private func applyExtraHeaders(_ extraHeaders: [String: String], to headers: inout [String: String]) {
        for (name, value) in extraHeaders {
            headers[name.lowercased()] = value
        }
    }
}
