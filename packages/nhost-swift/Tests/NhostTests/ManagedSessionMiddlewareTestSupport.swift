import Foundation
import XCTest
@testable import Nhost

enum ManagedMiddlewareTestError: Error, Equatable {
    case storageRead
    case storageWrite
    case storageRemove
}

actor ManagedRecordingTransport: HTTPTransport {
    typealias Handler = @Sendable (NhostRequest) async throws -> NhostRawResponse

    private let handler: Handler
    private var recordedRequests: [NhostRequest] = []

    init(handler: @escaping Handler) {
        self.handler = handler
    }

    func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        recordedRequests.append(request)
        return try await handler(request)
    }

    func requests() -> [NhostRequest] {
        recordedRequests
    }
}

actor FaultInjectingSessionBackend: SessionStorageBackend {
    private var session: StoredSession?
    private var getFailure: ManagedMiddlewareTestError?
    private var setFailures: Int
    private var removeFailures: Int
    private var setCalls = 0
    private var removeCalls = 0

    init(
        session: StoredSession? = nil,
        getFailure: ManagedMiddlewareTestError? = nil,
        setFailures: Int = 0,
        removeFailures: Int = 0
    ) {
        self.session = session
        self.getFailure = getFailure
        self.setFailures = setFailures
        self.removeFailures = removeFailures
    }

    func get() async throws -> StoredSession? {
        if let getFailure { throw getFailure }
        return session
    }

    func set(_ value: StoredSession) async throws {
        setCalls += 1
        if setFailures > 0 {
            setFailures -= 1
            throw ManagedMiddlewareTestError.storageWrite
        }
        session = value
    }

    func remove() async throws {
        removeCalls += 1
        if removeFailures > 0 {
            removeFailures -= 1
            throw ManagedMiddlewareTestError.storageRemove
        }
        session = nil
    }

    func counts() -> (set: Int, remove: Int) {
        (setCalls, removeCalls)
    }
}

actor ManagedCancellationGate {
    private var isEntered = false
    private var entryWaiters: [CheckedContinuation<Void, Never>] = []
    private var releaseWaiter: CheckedContinuation<Void, Never>?

    func wait() async {
        isEntered = true
        let waiters = entryWaiters
        entryWaiters.removeAll()
        waiters.forEach { $0.resume() }
        await withCheckedContinuation { continuation in
            releaseWaiter = continuation
        }
    }

    func waitUntilEntered() async {
        guard !isEntered else { return }
        await withCheckedContinuation { continuation in
            entryWaiters.append(continuation)
        }
    }

    func release() {
        releaseWaiter?.resume()
        releaseWaiter = nil
    }
}

struct AlwaysFailingManagedCoordinator: SessionCoordinator {
    func withCoordination<Result: Sendable>(
        _ operation: @Sendable () async throws -> Result
    ) async throws -> Result {
        throw SessionCoordinationError.timedOut
    }
}

final class RecursiveManagedFetchBox: @unchecked Sendable {
    private let lock = NSLock()
    private var fetchFunction: FetchFunction?

    func set(_ fetch: @escaping FetchFunction) {
        lock.withLock { fetchFunction = fetch }
    }

    func fetch(_ request: NhostRequest) async throws -> NhostRawResponse {
        let fetch = lock.withLock { fetchFunction }
        return try await XCTUnwrap(fetch)(request)
    }
}

let managedAuthTestBaseURL = URL(string: "https://auth.example.test/v1")!

func managedPolicy(_ operationID: String) -> ManagedAuthOperationPolicy? {
    ManagedAuthOperationAudit.entries.first { $0.operationID == operationID }?.policy
}

func managedRequest(_ method: String, _ path: String, body: Data? = nil) -> NhostRequest {
    NhostRequest(
        method: method,
        url: NhostURLBuilder.join(baseURL: managedAuthTestBaseURL, path: path),
        body: body
    )
}

func makeManagedPipeline(
    store: SessionStore,
    transport: any HTTPTransport,
    refresher: SessionRefresher? = nil,
    userMiddleware: [ChainFunction] = []
) -> NhostFetchPipeline {
    NhostFetchPipeline(
        transport: transport,
        middleware: [
            managedSessionMiddleware(
                authBaseURL: managedAuthTestBaseURL,
                sessionStore: store,
                refresher: refresher,
                marginSeconds: 60
            )
        ] + userMiddleware + [managedAuthRequestValidationMiddleware(authBaseURL: managedAuthTestBaseURL)]
    )
}
