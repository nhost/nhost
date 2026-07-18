import Foundation
import XCTest
@testable import Nhost

private actor UploadPreflightGate {
    private var entered = false
    private var releaseContinuation: CheckedContinuation<Void, Never>?
    private var entryWaiters: [CheckedContinuation<Void, Never>] = []

    func wait() async {
        entered = true
        let waiters = entryWaiters
        entryWaiters.removeAll()
        waiters.forEach { $0.resume() }
        await withCheckedContinuation { continuation in
            releaseContinuation = continuation
        }
    }

    func waitUntilEntered() async {
        guard !entered else { return }
        await withCheckedContinuation { continuation in
            entryWaiters.append(continuation)
        }
    }

    func release() {
        releaseContinuation?.resume()
        releaseContinuation = nil
    }
}

private final class ControlledUploadTask<Success: Sendable>: @unchecked Sendable {
    typealias Completion = @Sendable (Result<Success, any Error>) -> Void

    private let lock = NSLock()
    private let completionOnCancel: Result<Success, any Error>?
    private var completion: Completion?
    private var startCount = 0
    private var cancelCount = 0
    private var startWaiters: [CheckedContinuation<Void, Never>] = []

    init(completionOnCancel: Result<Success, any Error>? = nil) {
        self.completionOnCancel = completionOnCancel
    }

    func makeTask(completion: @escaping Completion) -> URLSessionUploadTaskHandle {
        lock.withLock {
            self.completion = completion
        }
        return URLSessionUploadTaskHandle(
            resume: { [self] in markStarted() },
            cancel: { [self] in cancel() }
        )
    }

    func waitUntilStarted() async {
        await withCheckedContinuation { continuation in
            let resumeImmediately = lock.withLock {
                guard startCount == 0 else { return true }
                startWaiters.append(continuation)
                return false
            }
            if resumeImmediately {
                continuation.resume()
            }
        }
    }

    func complete(_ result: Result<Success, any Error>) {
        let completion = lock.withLock { self.completion }
        completion?(result)
    }

    func counts() -> (starts: Int, cancellations: Int) {
        lock.withLock { (startCount, cancelCount) }
    }

    private func markStarted() {
        let waiters: [CheckedContinuation<Void, Never>] = lock.withLock {
            startCount += 1
            let waiters = startWaiters
            startWaiters.removeAll()
            return waiters
        }
        waiters.forEach { $0.resume() }
    }

    private func cancel() {
        let completion: Completion? = lock.withLock {
            cancelCount += 1
            return completionOnCancel == nil ? nil : self.completion
        }
        if let completionOnCancel {
            completion?(completionOnCancel)
        }
    }
}

final class ErrorExtractionTests: XCTestCase {
    func testExtractsCommonMessageShapes() throws {
        let body = Data(
            #"{"message":"top","error":{"message":"nested"},"errors":[{"message":"first"},{"error":"second"}]}"#.utf8
        )

        let error = NhostHTTPError.decode(
            status: 400,
            headers: ["content-type": "application/json"],
            body: body
        )

        XCTAssertEqual(error.status, 400)
        XCTAssertEqual(error.headers["content-type"], "application/json")
        XCTAssertEqual(error.body?["message"]?.stringValue, "top")
        XCTAssertEqual(error.messages, ["top", "nested", "first", "second"])
    }

    func testFallsBackToStatusMessage() {
        let error = NhostHTTPError.decode(status: 503, headers: [:], body: Data())

        XCTAssertNil(error.body)
        XCTAssertEqual(error.messages, ["HTTP request failed with status 503"])
        XCTAssertEqual(FetchError.http(error).status, 503)
        XCTAssertEqual(FetchError.http(error).messages, error.messages)
    }

    func testDecodedBodyExtractsTypedErrorModels() {
        let body = Data(#"{"status":401,"message":"Incorrect email or password","error":"invalid-email-password"}"#.utf8)
        let fetchError = FetchError.http(
            NhostHTTPError.decode(status: 401, headers: [:], body: body)
        )

        let decoded = fetchError.decodedBody(AuthErrorResponse.self)
        XCTAssertEqual(decoded?.error, .invalidEmailPassword)
        XCTAssertEqual(decoded?.message, "Incorrect email or password")
        XCTAssertNil(FetchError.transport("offline").decodedBody(AuthErrorResponse.self))
    }

    func testAllServiceErrorsShareTheNhostServiceErrorSurface() {
        let errors: [any NhostServiceError] = [
            FetchError.http(NhostHTTPError.decode(status: 401, headers: ["x-a": "1"], body: Data())),
            GraphQLExecutionError(
                errors: [GraphQLError(message: "boom")],
                status: 200,
                headers: ["x-b": "2"],
                rawBody: Data()
            ),
            FunctionsHTTPError(
                status: 500,
                headers: ["x-c": "3"],
                body: .text("Internal Server Error"),
                rawBody: Data(),
                messages: ["Internal Server Error"]
            ),
        ]

        XCTAssertEqual(errors.map { $0.statusCode }, [401, 200, 500])
        XCTAssertEqual(
            errors.map { $0.responseHeaders },
            [["x-a": "1"], ["x-b": "2"], ["x-c": "3"]]
        )
        XCTAssertEqual(
            errors.map { $0.messages },
            [
                ["HTTP request failed with status 401"],
                ["boom"],
                ["Internal Server Error"],
            ]
        )
    }

    func testDecodingErrorsKeepCodingPathContext() async {
        let transport = StubTransport { _ in
            NhostRawResponse(
                status: 200,
                headers: ["content-type": "application/json"],
                body: Data(#"{"buildVersion":123}"#.utf8)
            )
        }
        let client = StorageClient(
            baseURL: URL(string: "https://storage.example.test/v1")!,
            transport: transport
        )

        do {
            _ = try await client.getVersion()
            XCTFail("Expected a decoding error")
        } catch let FetchError.decoding(message) {
            XCTAssertTrue(
                message.contains("buildVersion"),
                "decoding error should keep the coding path, got: \(message)"
            )
        } catch {
            XCTFail("Expected FetchError.decoding, got \(error)")
        }
    }

    func testURLSessionTransportPropagatesCancellation() async {
        let transport = URLSessionTransport()
        let request = NhostRequest(
            method: "GET",
            url: URL(string: "https://nhost-cancellation.invalid/v1")!
        )

        let task = Task {
            while !Task.isCancelled { await Task.yield() }
            _ = try await transport.fetch(request)
        }
        task.cancel()

        do {
            try await task.value
            XCTFail("Expected CancellationError")
        } catch is CancellationError {
            // expected: cancellation is not converted into FetchError.transport
        } catch {
            XCTFail("Expected CancellationError, got \(error)")
        }
    }

    func testUploadBridgeCancelsBeforeTaskStartsWhenParentIsAlreadyCancelled() async {
        let gate = UploadPreflightGate()
        let controlledTask = ControlledUploadTask<Int>()
        let task = Task {
            await gate.wait()
            return try await withCancellableURLSessionUploadTask(controlledTask.makeTask)
        }

        await gate.waitUntilEntered()
        task.cancel()
        await gate.release()

        do {
            _ = try await task.value
            XCTFail("Expected CancellationError")
        } catch is CancellationError {
            // expected
        } catch {
            XCTFail("Expected CancellationError, got \(error)")
        }

        let counts = controlledTask.counts()
        XCTAssertEqual(counts.starts, 0)
        XCTAssertEqual(counts.cancellations, 1)
    }

    func testUploadBridgeCancelsInFlightTaskAndIgnoresLateCompletion() async {
        let controlledTask = ControlledUploadTask<Int>()
        let task = Task {
            try await withCancellableURLSessionUploadTask(controlledTask.makeTask)
        }

        await controlledTask.waitUntilStarted()
        task.cancel()

        do {
            _ = try await task.value
            XCTFail("Expected CancellationError")
        } catch is CancellationError {
            // expected
        } catch {
            XCTFail("Expected CancellationError, got \(error)")
        }

        controlledTask.complete(.success(42))
        let counts = controlledTask.counts()
        XCTAssertEqual(counts.starts, 1)
        XCTAssertEqual(counts.cancellations, 1)
    }

    func testUploadBridgeCancellationWinsSynchronousCompletionRace() async {
        let controlledTask = ControlledUploadTask<Int>(completionOnCancel: .success(42))
        let task = Task {
            try await withCancellableURLSessionUploadTask(controlledTask.makeTask)
        }

        await controlledTask.waitUntilStarted()
        task.cancel()

        do {
            _ = try await task.value
            XCTFail("Expected CancellationError")
        } catch is CancellationError {
            // expected: the callback fired reentrantly from cancel and was ignored
        } catch {
            XCTFail("Expected CancellationError, got \(error)")
        }

        let counts = controlledTask.counts()
        XCTAssertEqual(counts.starts, 1)
        XCTAssertEqual(counts.cancellations, 1)
    }

    func testUploadBridgeCompletionWinsBeforeCancellation() async throws {
        let controlledTask = ControlledUploadTask<Int>()
        let task = Task {
            try await withCancellableURLSessionUploadTask(controlledTask.makeTask)
        }

        await controlledTask.waitUntilStarted()
        controlledTask.complete(.success(42))
        let value = try await task.value
        task.cancel()

        XCTAssertEqual(value, 42)
        let counts = controlledTask.counts()
        XCTAssertEqual(counts.starts, 1)
        XCTAssertEqual(counts.cancellations, 0)
    }
}
