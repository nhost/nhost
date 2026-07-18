import Foundation
import XCTest
@testable import Nhost

private actor StreamingRecorder {
    private(set) var requests: [NhostRequest] = []
    private(set) var bodyFileContents: [Data] = []
    private var requestWaiters: [CheckedContinuation<NhostRequest, Never>] = []

    func record(_ request: NhostRequest) {
        requests.append(request)

        if let fileURL = request.bodyFileURL, let contents = try? Data(contentsOf: fileURL) {
            bodyFileContents.append(contents)
        }

        let waiters = requestWaiters
        requestWaiters.removeAll()
        waiters.forEach { $0.resume(returning: request) }
    }

    func waitForRequest() async -> NhostRequest {
        if let request = requests.first {
            return request
        }
        return await withCheckedContinuation { continuation in
            requestWaiters.append(continuation)
        }
    }
}

private final class CancellableStreamingTransport: HTTPTransport, @unchecked Sendable {
    let recorder = StreamingRecorder()

    private let lock = NSLock()
    private var cancellations = 0

    func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        await recorder.record(request)
        return try await withCancellableURLSessionUploadTask { _ in
            URLSessionUploadTaskHandle(
                resume: {},
                cancel: { [self] in recordCancellation() }
            )
        }
    }

    func cancellationCount() -> Int {
        lock.withLock { cancellations }
    }

    private func recordCancellation() {
        lock.withLock { cancellations += 1 }
    }
}

final class StorageStreamingTests: XCTestCase {
    private static let uploadResponse = NhostRawResponse(
        status: 201,
        headers: ["content-type": "application/json"],
        body: Data(
            """
            {
              "processedFiles": [
                {
                  "id": "f1",
                  "name": "a.bin",
                  "size": 4,
                  "bucketId": "default",
                  "etag": "e",
                  "createdAt": "2026-01-01T00:00:00Z",
                  "updatedAt": "2026-01-01T00:00:00Z",
                  "isUploaded": true,
                  "mimeType": "application/octet-stream"
                }
              ]
            }
            """.utf8
        )
    )

    private func normalizedBody(_ body: Data, contentType: String?) throws -> String {
        let boundary = try XCTUnwrap(
            contentType?.components(separatedBy: "boundary=").last,
            "content-type should carry the boundary"
        )
        let text = try XCTUnwrap(String(data: body, encoding: .utf8))

        return text.replacingOccurrences(of: boundary, with: "BOUNDARY")
    }

    func testStreamingUploadMatchesGeneratedWireFormatForDataSources() async throws {
        let recorder = StreamingRecorder()
        let transport = StubTransport { request in
            await recorder.record(request)
            return Self.uploadResponse
        }
        let client = StorageClient(
            baseURL: try XCTUnwrap(URL(string: "https://storage.example.test/v1")),
            transport: transport
        )

        let fileBytes = Data("file-contents".utf8)
        let metadata: [String: JSONValue] = ["kind": .string("avatar")]

        _ = try await client.uploadFiles(
            body: StorageUploadFilesBody(
                bucketId: "default",
                metadata: [StorageUploadFileMetadata(id: "custom-id", metadata: metadata)],
                file: [fileBytes]
            )
        )
        _ = try await client.uploadFiles(
            bucketId: "default",
            files: [.data(fileBytes, id: "custom-id", metadata: metadata)]
        )

        let requests = await recorder.requests
        XCTAssertEqual(requests.count, 2)

        let generated = try XCTUnwrap(requests.first)
        let streaming = try XCTUnwrap(requests.last)
        XCTAssertNil(streaming.bodyFileURL, "all-data uploads stay in memory")

        let generatedBody = try normalizedBody(
            try XCTUnwrap(generated.body),
            contentType: generated.headers["content-type"]
        )
        let streamingBody = try normalizedBody(
            try XCTUnwrap(streaming.body),
            contentType: streaming.headers["content-type"]
        )
        XCTAssertEqual(streamingBody, generatedBody, "streaming variant must mirror the generated wire layout")
    }

    func testFileURLSourcesAreStreamedFromDiskAndCleanedUp() async throws {
        let recorder = StreamingRecorder()
        let transport = StubTransport { request in
            await recorder.record(request)
            return Self.uploadResponse
        }
        let client = StorageClient(
            baseURL: try XCTUnwrap(URL(string: "https://storage.example.test/v1")),
            transport: transport
        )

        let payload = Data((0..<(3 * 1024 * 1024)).map { UInt8(truncatingIfNeeded: $0) })
        let sourceURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("nhost-streaming-test-\(UUID().uuidString).bin")
        try payload.write(to: sourceURL)
        defer { try? FileManager.default.removeItem(at: sourceURL) }

        let response = try await client.uploadFiles(
            bucketId: "default",
            files: [.fileURL(sourceURL, metadata: ["kind": .string("blob")])]
        )

        let requests = await recorder.requests
        let bodies = await recorder.bodyFileContents
        let request = try XCTUnwrap(requests.first)
        let multipartBody = try XCTUnwrap(bodies.first)
        let bodyFileURL = try XCTUnwrap(request.bodyFileURL)

        XCTAssertEqual(response.status, 201)
        XCTAssertNil(request.body, "streamed uploads must not buffer the body in the request")
        XCTAssertTrue(request.headers["content-type"]?.hasPrefix("multipart/form-data; boundary=") == true)
        XCTAssertTrue(multipartBody.range(of: payload) != nil, "multipart body must contain the file bytes")
        XCTAssertTrue(
            String(decoding: multipartBody.prefix(1024), as: UTF8.self)
                .contains(#"filename="\#(sourceURL.lastPathComponent)""#)
        )
        XCTAssertFalse(
            FileManager.default.fileExists(atPath: bodyFileURL.path),
            "temporary multipart file must be deleted after the upload"
        )
    }

    func testCancelledStreamingUploadCleansUpTemporaryMultipartFile() async throws {
        let transport = CancellableStreamingTransport()
        let client = StorageClient(
            baseURL: try XCTUnwrap(URL(string: "https://storage.example.test/v1")),
            transport: transport
        )

        let sourceURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("nhost-streaming-cancellation-\(UUID().uuidString).bin")
        try Data("cancel-me".utf8).write(to: sourceURL)
        defer { try? FileManager.default.removeItem(at: sourceURL) }

        let upload = Task {
            try await client.uploadFiles(files: [.fileURL(sourceURL)])
        }
        let request = await transport.recorder.waitForRequest()
        let temporaryBodyURL = try XCTUnwrap(request.bodyFileURL)
        XCTAssertTrue(FileManager.default.fileExists(atPath: temporaryBodyURL.path))

        upload.cancel()
        do {
            _ = try await upload.value
            XCTFail("Expected CancellationError")
        } catch is CancellationError {
            // expected
        } catch {
            XCTFail("Expected CancellationError, got \(error)")
        }

        XCTAssertEqual(transport.cancellationCount(), 1)
        XCTAssertFalse(
            FileManager.default.fileExists(atPath: temporaryBodyURL.path),
            "temporary multipart file must be deleted after cancellation"
        )
    }

    func testMultipartEncodeToFileMatchesInMemoryEncoding() throws {
        let fileBytes = Data("streamed-bytes".utf8)
        let sourceURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("nhost-encoder-test-\(UUID().uuidString).bin")
        try fileBytes.write(to: sourceURL)
        defer { try? FileManager.default.removeItem(at: sourceURL) }

        let dataParts: [NhostMultipartPart] = [
            .formField(name: "bucket-id", value: .string("default")),
            .file(name: "file[]", filename: "a.bin", contentType: "application/octet-stream", data: fileBytes),
        ]
        let fileParts: [NhostMultipartPart] = [
            .formField(name: "bucket-id", value: .string("default")),
            .file(name: "file[]", filename: "a.bin", contentType: "application/octet-stream", fileURL: sourceURL),
        ]

        let inMemory = try NhostMultipartEncoder.encode(parts: dataParts, boundary: "boundary")
        let onDisk = try NhostMultipartEncoder.encodeToFile(parts: fileParts, boundary: "boundary")
        defer { try? FileManager.default.removeItem(at: onDisk.fileURL) }

        XCTAssertEqual(try Data(contentsOf: onDisk.fileURL), inMemory.body)
        XCTAssertEqual(onDisk.contentType, inMemory.contentType)
    }
}
